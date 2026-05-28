import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { evoGoSendMedia, evoGoExtractMessageId, EVO_GO_BASE_URL, resolveEvoConfig } from "../_shared/evo-go.ts";

const WEBHOOK_SECRET = Deno.env.get("WHATSAPP_AGENT_SECRET");

/**
 * Sends one or more images to a WhatsApp contact via Evolution API.
 * Designed to be called from N8N automation workflows.
 *
 * POST body:
 *  - organization_id or instance_name: string (required)
 *  - phone: string                            (required)
 *  - images: Array<{ url: string, caption?: string }>  (required, max 20)
 *  - delay_ms?: number                        (delay between sends, default 1500, max 5000)
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

    if (!EVO_GO_BASE_URL) {
      throw new Error("EVOLUTION_GO_URL not configured");
    }

    const body = await req.json();
    const { organization_id, instance_name, phone, images, delay_ms = 1500 } = body;

    if (!phone || !Array.isArray(images) || images.length === 0) {
      return new Response(JSON.stringify({ error: "phone e images[] são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (images.length > 20) {
      return new Response(JSON.stringify({ error: "Máximo de 20 imagens por envio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();

    // Resolve instance config
    const config = await resolveEvoConfig(sb, instance_name || organization_id);

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

    const cleanPhone = phone.replace(/\D/g, "");
    const delayBetween = Math.min(Math.max(Number(delay_ms) || 1500, 500), 5000);
    const results: Array<{ index: number; success: boolean; error?: string }> = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (!img.url) {
        results.push({ index: i, success: false, error: "URL vazia" });
        continue;
      }

      const evoRes = await evoGoSendMedia(config.instance_token, {
        number: cleanPhone,
        url: img.url,
        type: "image",
        caption: img.caption || "",
      });

      if (!evoRes.ok) {
        console.error(`Send image ${i} failed [${evoRes.status}]: ${evoRes.raw.slice(0, 300)}`);
        results.push({ index: i, success: false, error: `HTTP ${evoRes.status}` });
      } else {
        try {
          const remoteJid = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
          await sb.from("whatsapp_messages").insert({
            organization_id: config.organization_id,
            instance_name: config.instance_name,
            remote_jid: remoteJid,
            from_me: true,
            message_text: img.caption || "[Imagem enviada]",
            message_type: "image",
            message_id: evoGoExtractMessageId(evoRes.data),
            timestamp: new Date().toISOString(),
            sender_type: "ai",
            media_url: img.url,
          });
        } catch (persistErr) {
          console.warn(`Failed to persist image message ${i}:`, persistErr);
        }
        results.push({ index: i, success: true });
      }

      if (i < images.length - 1) {
        await new Promise((r) => setTimeout(r, delayBetween));
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(JSON.stringify({ 
      success: failed === 0, 
      sent, 
      failed, 
      total: images.length,
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("whatsapp-send-media error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
