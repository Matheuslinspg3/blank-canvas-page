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

    switch (operation) {
      case "migrate_property_owners": {
        // Migrate owners from properties to property_owners table
        const { data, error } = await adminClient.rpc("exec_sql", {
          query: `
            WITH inserted AS (
              INSERT INTO property_owners (property_id, owner_name, owner_phone, owner_email, owner_document)
              SELECT p.id, p.owner_name, p.owner_phone, p.owner_email, p.owner_document
              FROM properties p
              WHERE p.owner_name IS NOT NULL AND p.owner_name != ''
                AND NOT EXISTS (SELECT 1 FROM property_owners po WHERE po.property_id = p.id)
              LIMIT ${Math.min(batchSize, 500)}
              RETURNING 1
            )
            SELECT count(*)::int as cnt FROM inserted
          `,
        });

        if (error) {
          // Fallback: try direct insert without RPC
          const { data: props, error: fetchErr } = await adminClient
            .from("properties")
            .select("id, owner_name, owner_phone, owner_email, owner_document")
            .not("owner_name", "is", null)
            .neq("owner_name", "")
            .limit(Math.min(batchSize, 500));

          if (fetchErr) throw fetchErr;

          // Filter out already migrated
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

        const count = data?.[0]?.cnt || 0;
        result = {
          affected: count,
          message: count > 0
            ? `${count} proprietários migrados neste lote`
            : "Migração completa! Nenhum registro pendente.",
        };
        break;
      }

      case "cleanup_lead_stages": {
        // Delete lead stages that have no associated leads
        const { data: stages, error: stagesErr } = await adminClient
          .from("lead_stages")
          .select("id, name, organization_id");

        if (stagesErr) throw stagesErr;

        let deleted = 0;
        for (const stage of stages || []) {
          const { count } = await adminClient
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("stage_id", stage.id);

          if (count === 0) {
            await adminClient.from("lead_stages").delete().eq("id", stage.id);
            deleted++;
          }
        }

        result = {
          affected: deleted,
          message: deleted > 0
            ? `${deleted} estágios órfãos removidos`
            : "Nenhum estágio órfão encontrado.",
        };
        break;
      }

      case "check_status": {
        // Check migration status
        const { count: totalProps } = await adminClient
          .from("properties")
          .select("id", { count: "exact", head: true })
          .not("owner_name", "is", null)
          .neq("owner_name", "");

        const { count: migratedCount } = await adminClient
          .from("property_owners")
          .select("id", { count: "exact", head: true });

        result = {
          affected: 0,
          message: `Proprietários: ${migratedCount || 0} migrados de ${totalProps || 0} no total. Pendentes: ${(totalProps || 0) - (migratedCount || 0)}.`,
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
