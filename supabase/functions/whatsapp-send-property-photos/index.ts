import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

/**
 * Unified function: fetches property images and sends them via WhatsApp.
 * Combines whatsapp-property-images + whatsapp-send-media in a single call.
 *
 * POST body:
 *  - instance_name: string          (required)
 *  - phone: string                  (required)
 *  - property_ids: string[]         (required, max 20)
 *  - mode: "cover" | "all"          (default: "cover")
 *  - limit_per_property: number     (default: 20, max 30)
 *  - delay_ms: number               (delay between sends, default 1500, max 5000)
 *  - caption_template: string       (optional, e.g. "{title} - {neighborhood}")
 */
serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const secret = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
    if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error("EVOLUTION_API_URL or EVOLUTION_API_GLOBAL_KEY not configured");
    }

    const body = await req.json();
    const {
      instance_name,
      phone,
      property_ids,
      mode = "cover",
      limit_per_property = 20,
      delay_ms = 1500,
      caption_template,
    } = body;

    if (!instance_name || !phone || !Array.isArray(property_ids) || property_ids.length === 0) {
      return new Response(JSON.stringify({ error: "instance_name, phone e property_ids[] são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (property_ids.length > 20) {
      return new Response(JSON.stringify({ error: "Máximo de 20 imóveis por envio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();

    // --- Resolve instance config ---
    const { data: config } = await sb
      .from("whatsapp_agent_config")
      .select("organization_id, instance_name, status")
      .eq("instance_name", instance_name)
      .maybeSingle();

    if (!config?.instance_name) {
      return new Response(JSON.stringify({ error: "Configuração WhatsApp não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (config.status !== "connected") {
      return new Response(JSON.stringify({ error: "WhatsApp desconectado" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = config.organization_id;
    const R2_PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") ?? "").trim().replace(/\/$/, "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const limitCapped = Math.min(Number(limit_per_property) || 20, 30);

    // --- Step 1: Fetch images ---
    let query = sb
      .from("property_images")
      .select("id, property_id, url, r2_key_full, r2_key_thumb, storage_provider, is_cover, display_order, cached_thumbnail_url")
      .in("property_id", property_ids.slice(0, 20))
      .order("is_cover", { ascending: false })
      .order("display_order", { ascending: true });

    if (mode === "cover") {
      query = query.eq("is_cover", true);
    }

    const { data: images, error: imgError } = await query.limit(property_ids.length * limitCapped);
    if (imgError) throw imgError;

    // Resolve URLs
    const resolveUrl = (img: any): string => {
      if (img.storage_provider === "r2" && img.r2_key_full && R2_PUBLIC_URL) {
        return `${R2_PUBLIC_URL}/${img.r2_key_full}`;
      }
      if (img.url && img.url.includes("res.cloudinary.com")) {
        return `${SUPABASE_URL}/functions/v1/cloudinary-image-proxy?url=${encodeURIComponent(img.url)}`;
      }
      return img.url || "";
    };

    // Group by property_id
    const grouped: Record<string, any[]> = {};
    for (const img of (images || [])) {
      const pid = img.property_id;
      if (!grouped[pid]) grouped[pid] = [];
      if (grouped[pid].length >= limitCapped) continue;
      grouped[pid].push({
        id: img.id,
        property_id: pid,
        url: resolveUrl(img),
        is_cover: img.is_cover,
        display_order: img.display_order,
      });
    }

    // Cover mode fallback: if no is_cover found, fetch first image
    if (mode === "cover") {
      const missingCover = property_ids.filter((pid: string) => !grouped[pid] || grouped[pid].length === 0);
      if (missingCover.length > 0) {
        const { data: fallbackImgs } = await sb
          .from("property_images")
          .select("id, property_id, url, r2_key_full, storage_provider, is_cover, display_order")
          .in("property_id", missingCover)
          .eq("organization_id", orgId)
          .order("display_order", { ascending: true })
          .limit(missingCover.length);

        for (const img of (fallbackImgs || [])) {
          const pid = img.property_id;
          if (!grouped[pid]) {
            grouped[pid] = [{
              id: img.id,
              property_id: pid,
              url: resolveUrl(img),
              is_cover: img.is_cover,
              display_order: img.display_order,
            }];
          }
        }
      }
    }

    // --- Fetch property titles for captions ---
    const allPropertyIds = Object.keys(grouped);
    let propertyInfo: Record<string, { title: string; neighborhood: string }> = {};
    if (allPropertyIds.length > 0) {
      const { data: props } = await sb
        .from("properties")
        .select("id, title, address_neighborhood")
        .in("id", allPropertyIds);

      for (const p of (props || [])) {
        propertyInfo[p.id] = {
          title: p.title || "Imóvel",
          neighborhood: p.address_neighborhood || "",
        };
      }
    }

    // --- Step 2: Send images via Evolution API ---
    const cleanPhone = phone.replace(/\D/g, "");
    const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
    const endpoint = `${baseUrl}/message/sendMedia/${config.instance_name}`;
    const delayBetween = Math.min(Math.max(Number(delay_ms) || 1500, 500), 5000);

    // Flatten all images into a send queue
    const sendQueue: Array<{ url: string; caption: string; property_id: string }> = [];
    for (const pid of allPropertyIds) {
      const info = propertyInfo[pid] || { title: "Imóvel", neighborhood: "" };
      const imgs = grouped[pid] || [];
      for (let i = 0; i < imgs.length; i++) {
        let caption = "";
        if (caption_template) {
          caption = caption_template
            .replace("{title}", info.title)
            .replace("{neighborhood}", info.neighborhood)
            .replace("{index}", String(i + 1))
            .replace("{total}", String(imgs.length));
        } else if (mode === "cover") {
          caption = info.neighborhood ? `${info.title} - ${info.neighborhood}` : info.title;
        } else {
          caption = i === 0 ? info.title : `${info.title} (${i + 1}/${imgs.length})`;
        }
        sendQueue.push({ url: imgs[i].url, caption, property_id: pid });
      }
    }

    if (sendQueue.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        sent: 0,
        failed: 0,
        total: 0,
        message: "Nenhuma imagem encontrada para os imóveis informados",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ index: number; property_id: string; success: boolean; error?: string }> = [];
    const remoteJid = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;

    for (let i = 0; i < sendQueue.length; i++) {
      const item = sendQueue[i];
      if (!item.url) {
        results.push({ index: i, property_id: item.property_id, success: false, error: "URL vazia" });
        continue;
      }

      try {
        const evoRes = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({
            number: cleanPhone,
            mediatype: "image",
            media: item.url,
            caption: item.caption || "",
          }),
        });

        if (!evoRes.ok) {
          const errData = await evoRes.text();
          console.error(`Send image ${i} failed [${evoRes.status}]: ${errData}`);
          results.push({ index: i, property_id: item.property_id, success: false, error: `HTTP ${evoRes.status}` });
        } else {
          const evoData = await evoRes.json();

          // Persist to whatsapp_messages
          try {
            await sb.from("whatsapp_messages").insert({
              organization_id: orgId,
              instance_name: config.instance_name,
              remote_jid: remoteJid,
              from_me: true,
              message_text: item.caption || "[Imagem enviada]",
              message_type: "image",
              message_id: evoData?.key?.id || null,
              timestamp: new Date().toISOString(),
              sender_type: "ai",
              media_url: item.url,
            });
          } catch (persistErr) {
            console.warn(`Failed to persist image message ${i}:`, persistErr);
          }

          results.push({ index: i, property_id: item.property_id, success: true });
        }
      } catch (fetchErr: any) {
        console.error(`Send image ${i} fetch error:`, fetchErr);
        results.push({ index: i, property_id: item.property_id, success: false, error: fetchErr.message });
      }

      // Delay between sends
      if (i < sendQueue.length - 1) {
        await new Promise((r) => setTimeout(r, delayBetween));
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(JSON.stringify({
      success: failed === 0,
      sent,
      failed,
      total: sendQueue.length,
      properties_found: allPropertyIds.length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("whatsapp-send-property-photos error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
