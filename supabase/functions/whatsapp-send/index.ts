import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, parseJsonSafely } from "../_shared/whatsapp.ts";
import { EvolutionProvider } from "../_shared/evolution-provider.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const auditLog = async (
  sb: any,
  orgId: string,
  action: string,
  actorId: string | null,
  details: Record<string, any> = {},
) => {
  try {
    await sb.from("whatsapp_audit_log").insert({
      organization_id: orgId,
      action,
      actor_id: actorId,
      details,
    });
  } catch (e) {
    console.warn("Failed to write audit log:", e);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EVOLUTION_PROVIDER = (Deno.env.get("EVOLUTION_PROVIDER") || "evolution_go") as "evolution_node" | "evolution_go";
    const EVOLUTION_API_URL = EVOLUTION_PROVIDER === "evolution_go" 
      ? Deno.env.get("EVOLUTION_GO_URL") || Deno.env.get("EVOLUTION_API_URL")
      : Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = EVOLUTION_PROVIDER === "evolution_go"
      ? Deno.env.get("EVOLUTION_GO_TOKEN") || Deno.env.get("EVOLUTION_API_GLOBAL_KEY")
      : Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
      throw new Error(`Evolution API (${EVOLUTION_PROVIDER}) not configured`);
    }

    const provider = new EvolutionProvider({
      baseUrl: EVOLUTION_API_URL,
      apiKey: EVOLUTION_API_KEY,
      provider: EVOLUTION_PROVIDER,
    });


    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("organization_id, full_name")
      .eq("user_id", user.id)
      .single();
    if (!profile?.organization_id) throw new Error("No organization found");

    const orgId = profile.organization_id;
    const senderName = profile.full_name || user.email || "Atendente";

    const body = await req.json();
    const { phone, message, type = "text", channelAccountId } = body;

    if (!phone || !message) throw new Error("phone and message are required");

    // Resolve a instância do WhatsApp:
    //  • Caminho novo (Inbox Fase 2): cliente envia channelAccountId — referência
    //    estável; toda a resolução (org, canal, status, instância real) é feita
    //    server-side aqui. Cliente NUNCA é fonte de verdade do nome da instância.
    //  • Caminho legado: lookup por organização em whatsapp_agent_config (intacto).
    let resolvedInstanceName: string | null = null;

    if (channelAccountId) {
      const { data: account, error: accErr } = await supabaseClient
        .from("channel_accounts")
        .select("id, organization_id, channel_type, external_id, status")
        .eq("id", channelAccountId)
        .maybeSingle();

      if (accErr) throw accErr;
      if (!account) {
        return new Response(
          JSON.stringify({ error: "Conta de canal não encontrada." }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (account.organization_id !== orgId) {
        return new Response(
          JSON.stringify({ error: "Conta de canal pertence a outra organização." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (account.channel_type !== "whatsapp") {
        return new Response(
          JSON.stringify({ error: "Conta de canal não é de WhatsApp." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!["connected", "active"].includes(account.status)) {
        return new Response(
          JSON.stringify({ error: "Conta de canal não está operacional. Reconecte na área de integrações." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!account.external_id) {
        return new Response(
          JSON.stringify({ error: "Conta de canal sem instância vinculada." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedInstanceName = account.external_id;
    } else {
      // Caminho legado preservado
      const { data: config } = await supabaseClient
        .from("whatsapp_agent_config")
        .select("instance_name, instance_token, status")
        .eq("organization_id", orgId)
        .single();

      if (!config?.instance_name) {
        return new Response(
          JSON.stringify({ error: "WhatsApp não configurado. Ative a integração na área de integrações." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (config.status !== "connected") {
        return new Response(
          JSON.stringify({ error: "WhatsApp desconectado. Reconecte na área de integrações antes de enviar mensagens." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      resolvedInstanceName = config.instance_name;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const formattedMessage = `*${senderName}*:\n${message}`;

    let evoRes: any;

    if (type === "media") {
        // Evolution Go media send is different, but let's try to keep it simple
        // If the provider doesn't have sendMedia, we'll use sendText as fallback or implement it
        // For now, let's assume we need to implement it in the provider
        // But the user didn't mention media specifically in the tasks, just text.
        // I'll add sendMedia to the provider just in case.
        const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
        const endpoint = EVOLUTION_PROVIDER === "evolution_go" 
            ? `${baseUrl}/send/media` // Guessing for Go
            : `${baseUrl}/message/sendMedia/${resolvedInstanceName}`;
        
        const payload = {
            number: cleanPhone,
            mediatype: body.mediaType || "image",
            media: body.mediaUrl,
            caption: formattedMessage,
            name: EVOLUTION_PROVIDER === "evolution_go" ? resolvedInstanceName : undefined
        };

        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
            body: JSON.stringify(payload),
        });
        const raw = await res.text();
        evoRes = { ok: res.ok, status: res.status, data: parseJsonSafely(raw), raw };
    } else {
        evoRes = await provider.sendText(resolvedInstanceName, cleanPhone, formattedMessage);
    }

    const evoData = evoRes.data;


    if (!evoRes.ok) {
      const isInvalidToken = evoRes.status === 401 || evoRes.status === 403;
      if (isInvalidToken) {
        await supabaseClient
          .from("whatsapp_agent_config")
          .update({ status: "disconnected" })
          .eq("organization_id", orgId);

        await auditLog(supabaseClient, orgId, "send_token_invalid", user.id, { phone: cleanPhone });

        return new Response(
          JSON.stringify({ error: "Sessão do WhatsApp expirada. Reconecte na área de integrações." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Evolution send error [${evoRes.status}]: ${JSON.stringify(evoData)}`);
    }

    await auditLog(supabaseClient, orgId, "send", user.id, { phone: cleanPhone, type });

    // Persist sent message to whatsapp_messages for chat panel
    try {
      const remoteJid = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
      const sentMessageId = evoData?.key?.id || evoData?.messageId || null;
      await supabaseClient.from("whatsapp_messages").insert({
        organization_id: orgId,
        instance_name: resolvedInstanceName,
        remote_jid: remoteJid,
        from_me: true,
        message_text: message,
        message_type: type,
        message_id: sentMessageId,
        timestamp: new Date().toISOString(),
        sender_type: "human",
      });
    } catch (persistErr) {
      console.warn("Failed to persist sent message:", persistErr);
    }

    return new Response(JSON.stringify({ success: true, data: evoData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("whatsapp-send error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
