import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is developer
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, supabaseKey);

    // Check developer role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "developer")
      .maybeSingle();

    if (!roleData) throw new Error("Not a developer");

    const { operation, batchSize = 100 } = await req.json();

    let result: { affected: number; message: string };

    const SOURCE_ORG = "fd75cd4a-5321-481d-a34b-87ee879e775c";
    const DEST_ORG = "cdf3f0e6-da64-4090-bc76-1758796bea28";

    switch (operation) {
      case "migrate_property_owners": {
        // Migrate owners from properties to property_owners table (legacy)
        const { data: props, error: fetchErr } = await adminClient
          .from("properties")
          .select("id, owner_name, owner_phone, owner_email, owner_document")
          .not("owner_name", "is", null)
          .neq("owner_name", "")
          .limit(Math.min(batchSize, 500));

        if (fetchErr) throw fetchErr;

        const propIds = (props || []).map((p: any) => p.id);
        const { data: existing } = await adminClient
          .from("property_owners")
          .select("property_id")
          .in("property_id", propIds);

        const existingIds = new Set((existing || []).map((e: any) => e.property_id));
        const toInsert = (props || [])
          .filter((p: any) => !existingIds.has(p.id))
          .map((p: any) => ({
            property_id: p.id,
            owner_name: p.owner_name,
            owner_phone: p.owner_phone,
            owner_email: p.owner_email,
            owner_document: p.owner_document,
          }));

        if (toInsert.length > 0) {
          const { error: insertErr } = await adminClient
            .from("property_owners")
            .insert(toInsert);
          if (insertErr) throw insertErr;
        }

        result = {
          affected: toInsert.length,
          message: toInsert.length > 0
            ? `${toInsert.length} proprietários migrados neste lote`
            : "Migração completa! Nenhum registro pendente.",
        };
        break;
      }

      case "migrate_owners_to_porto": {
        // Step 1: Migrate centralized owners from source org to dest org
        // Find owners in source that don't exist in dest (by phone)
        const { data: sourceOwners, error: soErr } = await adminClient
          .from("owners")
          .select("id, primary_name, phone, email, document, notes")
          .eq("organization_id", SOURCE_ORG)
          .order("primary_name")
          .limit(Math.min(batchSize, 200));

        if (soErr) throw soErr;
        if (!sourceOwners || sourceOwners.length === 0) {
          result = { affected: 0, message: "Nenhum owner pendente na org de origem." };
          break;
        }

        // Get existing phones in dest
        const { data: destOwners } = await adminClient
          .from("owners")
          .select("phone")
          .eq("organization_id", DEST_ORG);

        const existingPhones = new Set((destOwners || []).map((o: any) => o.phone));

        const newOwners = sourceOwners.filter((o: any) => !existingPhones.has(o.phone));

        if (newOwners.length === 0) {
          result = { affected: 0, message: "Todos os owners já existem no Porto Caiçara." };
          break;
        }

        // Insert new owners with dest org
        const ownersToInsert = newOwners.map((o: any) => ({
          primary_name: o.primary_name,
          phone: o.phone,
          email: o.email,
          document: o.document,
          notes: o.notes,
          organization_id: DEST_ORG,
        }));

        const { error: insertErr } = await adminClient
          .from("owners")
          .insert(ownersToInsert);

        if (insertErr) throw insertErr;

        result = {
          affected: ownersToInsert.length,
          message: `${ownersToInsert.length} owners copiados para o Porto Caiçara.`,
        };
        break;
      }

      case "migrate_property_owners_to_porto": {
        // Step 2: Migrate property_owners links, remapping property_id via source_property_id
        // and owner_id via phone matching
        const { data: sourcePOs, error: spoErr } = await adminClient
          .from("property_owners")
          .select("id, property_id, owner_id, name, phone, email, document, notes, is_primary")
          .eq("organization_id", SOURCE_ORG)
          .limit(Math.min(batchSize, 200));

        if (spoErr) throw spoErr;
        if (!sourcePOs || sourcePOs.length === 0) {
          result = { affected: 0, message: "Nenhum property_owner na org de origem." };
          break;
        }

        // Get property mapping: source prop id -> dest prop id
        const srcPropIds = [...new Set(sourcePOs.map((po: any) => po.property_id))];
        const { data: destProps } = await adminClient
          .from("properties")
          .select("id, source_property_id")
          .eq("organization_id", DEST_ORG)
          .in("source_property_id", srcPropIds);

        const propMap = new Map<string, string>();
        (destProps || []).forEach((p: any) => {
          if (p.source_property_id) propMap.set(p.source_property_id, p.id);
        });

        // Get owner mapping: phone -> dest owner id
        const { data: destOwnersList } = await adminClient
          .from("owners")
          .select("id, phone")
          .eq("organization_id", DEST_ORG);

        const ownerPhoneMap = new Map<string, string>();
        (destOwnersList || []).forEach((o: any) => {
          if (o.phone) ownerPhoneMap.set(o.phone, o.id);
        });

        // Get source owners for phone lookup
        const srcOwnerIds = [...new Set(sourcePOs.filter((po: any) => po.owner_id).map((po: any) => po.owner_id))];
        const { data: srcOwnerPhones } = await adminClient
          .from("owners")
          .select("id, phone")
          .in("id", srcOwnerIds.length > 0 ? srcOwnerIds : ["__none__"]);

        const srcOwnerPhoneMap = new Map<string, string>();
        (srcOwnerPhones || []).forEach((o: any) => {
          if (o.phone) srcOwnerPhoneMap.set(o.id, o.phone);
        });

        // Check which dest properties already have property_owners
        const destPropIds = [...propMap.values()];
        const { data: existingDestPOs } = await adminClient
          .from("property_owners")
          .select("property_id")
          .eq("organization_id", DEST_ORG)
          .in("property_id", destPropIds.length > 0 ? destPropIds : ["__none__"]);

        const existingDestPropIds = new Set((existingDestPOs || []).map((po: any) => po.property_id));

        const toInsert: any[] = [];
        for (const po of sourcePOs) {
          const destPropId = propMap.get(po.property_id);
          if (!destPropId) continue; // No matching property in Porto
          if (existingDestPropIds.has(destPropId)) continue; // Already has owner

          // Find dest owner_id by phone
          let destOwnerId: string | null = null;
          if (po.owner_id) {
            const srcPhone = srcOwnerPhoneMap.get(po.owner_id);
            if (srcPhone) {
              destOwnerId = ownerPhoneMap.get(srcPhone) || null;
            }
          }

          toInsert.push({
            property_id: destPropId,
            organization_id: DEST_ORG,
            owner_id: destOwnerId,
            name: po.name,
            phone: po.phone,
            email: po.email,
            document: po.document,
            notes: po.notes,
            is_primary: po.is_primary ?? true,
          });
        }

        if (toInsert.length > 0) {
          // Insert in chunks
          const CHUNK = 50;
          let inserted = 0;
          for (let i = 0; i < toInsert.length; i += CHUNK) {
            const chunk = toInsert.slice(i, i + CHUNK);
            const { error: insErr } = await adminClient
              .from("property_owners")
              .insert(chunk);
            if (insErr) throw insErr;
            inserted += chunk.length;
          }

          result = {
            affected: inserted,
            message: `${inserted} property_owners migrados para o Porto Caiçara.`,
          };
        } else {
          result = {
            affected: 0,
            message: "Todos os property_owners já migrados ou sem imóvel correspondente.",
          };
        }
        break;
      }

      case "migrate_aliases_to_porto": {
        // Step 3: Migrate owner_aliases
        const { data: srcOwners } = await adminClient
          .from("owners")
          .select("id, phone")
          .eq("organization_id", SOURCE_ORG);

        const { data: dstOwners } = await adminClient
          .from("owners")
          .select("id, phone")
          .eq("organization_id", DEST_ORG);

        const phoneToDestId = new Map<string, string>();
        (dstOwners || []).forEach((o: any) => { if (o.phone) phoneToDestId.set(o.phone, o.id); });

        const srcIdToPhone = new Map<string, string>();
        (srcOwners || []).forEach((o: any) => { if (o.phone) srcIdToPhone.set(o.id, o.phone); });

        // Get dest owner IDs
        const destOwnerIds = [...phoneToDestId.values()];
        const { data: existingAliases } = await adminClient
          .from("owner_aliases")
          .select("owner_id, name")
          .in("owner_id", destOwnerIds.length > 0 ? destOwnerIds : ["__none__"]);

        const existingAliasSet = new Set(
          (existingAliases || []).map((a: any) => `${a.owner_id}::${a.name}`)
        );

        // Get source aliases
        const srcOwnerIds = [...srcIdToPhone.keys()];
        const { data: srcAliases } = await adminClient
          .from("owner_aliases")
          .select("owner_id, name, occurrence_count")
          .in("owner_id", srcOwnerIds.length > 0 ? srcOwnerIds : ["__none__"])
          .limit(Math.min(batchSize, 500));

        if (!srcAliases || srcAliases.length === 0) {
          result = { affected: 0, message: "Nenhum alias pendente." };
          break;
        }

        const aliasesToInsert: any[] = [];
        for (const alias of srcAliases) {
          const phone = srcIdToPhone.get(alias.owner_id);
          if (!phone) continue;
          const destOwnerId = phoneToDestId.get(phone);
          if (!destOwnerId) continue;
          const key = `${destOwnerId}::${alias.name}`;
          if (existingAliasSet.has(key)) continue;

          aliasesToInsert.push({
            owner_id: destOwnerId,
            name: alias.name,
            occurrence_count: alias.occurrence_count || 1,
          });
          existingAliasSet.add(key);
        }

        if (aliasesToInsert.length > 0) {
          const { error: insErr } = await adminClient
            .from("owner_aliases")
            .insert(aliasesToInsert);
          if (insErr) throw insErr;
        }

        result = {
          affected: aliasesToInsert.length,
          message: aliasesToInsert.length > 0
            ? `${aliasesToInsert.length} aliases migrados.`
            : "Todos os aliases já migrados.",
        };
        break;
      }

      case "check_status": {
        // Check migration status for Porto
        const { count: srcOwners } = await adminClient
          .from("owners")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", SOURCE_ORG);

        const { count: destOwners } = await adminClient
          .from("owners")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", DEST_ORG);

        const { count: srcPO } = await adminClient
          .from("property_owners")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", SOURCE_ORG);

        const { count: destPO } = await adminClient
          .from("property_owners")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", DEST_ORG);

        result = {
          affected: 0,
          message: `Owners: ${destOwners || 0} no Porto (${srcOwners || 0} na origem). Property_owners: ${destPO || 0} no Porto (${srcPO || 0} na origem).`,
        };
        break;
      }

      default:
        throw new Error(`Operação desconhecida: ${operation}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Batch migration error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
