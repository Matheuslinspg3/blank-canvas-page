import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  corsHeaders, 
  parseJsonSafely, 
  classifyConnectionStatus, 
  extractPhoneNumber, 
  extractQrBase64, 
  extractPairingCode,
  safePreview
} from "../_shared/whatsapp.ts";
import { EvolutionProvider } from "../_shared/evolution-provider.ts";


const captureWhatsAppException = async (error: unknown, context: Record<string, unknown> = {}) => {
  try {
    const dsn = Deno.env.get("SENTRY_DSN");
    if (!dsn) return;
    const message = error instanceof Error ? error.message : String(error ?? "unknown_error");
    const now = new Date().toISOString();
    const payload = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: now,
      level: "error",
      platform: "javascript",
      environment: Deno.env.get("DENO_DEPLOYMENT_ID") ? "production" : "unknown",
      server_name: "supabase-edge",
      tags: {
        source: "whatsapp",
        ...((context.tags as Record<string, string> | undefined) ?? {}),
      },
      extra: {
        ...context,
      },
      exception: {
        values: [{
          type: error instanceof Error ? error.name : "Error",
          value: message,
        }],
      },
    };

    const url = new URL(dsn);
    const projectId = url.pathname.split("/").filter(Boolean).pop();
    if (!projectId) return;
    const key = url.username;
    const host = `${url.protocol}//${url.host}`;
    const sentryUrl = `${host}/api/${projectId}/store/?sentry_version=7&sentry_key=${encodeURIComponent(key)}`;
    await fetch(sentryUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // never break flow because of observability
  }
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    const EVOLUTION_PROVIDER = (Deno.env.get("EVOLUTION_PROVIDER") || "evolution_node") as "evolution_node" | "evolution_go";

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) throw new Error("Evolution API not configured");

    const provider = new EvolutionProvider({
      baseUrl: EVOLUTION_API_URL,
      apiKey: EVOLUTION_API_KEY,
      provider: EVOLUTION_PROVIDER,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const sb = createClient(supabaseUrl, serviceKey);
    const anon = createClient(supabaseUrl, anonKey);

    const { data: { user }, error: authErr } = await anon.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: profile } = await sb.from("profiles").select("organization_id").eq("user_id", user.id).single();
    if (!profile?.organization_id) throw new Error("No organization");

    const orgId = profile.organization_id;
    const userId = user.id;
    const body = await req.json();
    const { action } = body;

    // Helper: check if user is admin (can operate any channel in org)
    const { data: adminRole } = await sb.from("user_roles").select("role").eq("user_id", userId).in("role", ["admin", "sub_admin", "developer"]).limit(1);
    const isAdmin = (adminRole?.length ?? 0) > 0;

    // Get or create broker channel record
    const getBrokerChannel = async (forUserId?: string) => {
      const targetUser = forUserId && isAdmin ? forUserId : userId;
      const { data } = await sb.from("broker_whatsapp_channels").select("*").eq("organization_id", orgId).eq("user_id", targetUser).maybeSingle();
      return data;
    };

    // ── STATUS ──
    if (action === "status") {
      const channel = await getBrokerChannel(body.targetUserId);
      if (!channel) return json({ status: "disconnected", phone: null, qr_code: null });

      if (!channel.instance_name) {
        return json({ status: channel.status, phone: channel.phone_number, qr_code: channel.qr_code });
      }

      let newStatus: string = channel.status;
      let phone = channel.phone_number;

      try {
        const evoRes = await provider.getStatus(channel.instance_name);
        const evoRaw = evoRes.raw;
        const evoData = evoRes.data;

        if (evoRes.ok) {
          const evoStatus = classifyConnectionStatus(evoRaw, evoData?.state, evoData?.instance?.state, evoData?.status);
          if (evoStatus !== "unknown") newStatus = evoStatus;
          phone = extractPhoneNumber(evoData) ?? phone;
        }
      } catch (e) {
        console.warn("Evolution status check failed:", e);
      }


      const updatePayload: Record<string, unknown> = { status: newStatus };
      if (newStatus === "connected" || newStatus === "disconnected") updatePayload.qr_code = null;
      if (phone) updatePayload.phone_number = phone;

      await sb.from("broker_whatsapp_channels").update(updatePayload).eq("id", channel.id);

      return json({
        status: newStatus,
        phone,
        qr_code: newStatus === "connected" || newStatus === "disconnected" ? null : channel.qr_code,
      });
    }

    // ── CONNECT ──
    if (action === "connect") {
      const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
      const roleList = (roles ?? []).map((r: any) => r.role);
      if (roleList.includes("assistente") && roleList.length === 1) {
        return json({ error: "Assistentes não podem conectar WhatsApp individual" }, 403);
      }

      const rawPhone = String(body.phoneNumber ?? "").replace(/\D/g, "");
      const usePairing = rawPhone.length >= 10;

      const { data: org } = await sb.from("organizations").select("slug, name").eq("id", orgId).single();
      const orgSlug = org?.slug || orgId.substring(0, 8);
      const userShort = userId.substring(0, 8);
      const instanceName = `broker_${orgSlug}_${userShort}`;

      if (!instanceName || instanceName.includes("undefined")) {
        return json({ error: "Nome de instância inválido para o corretor" }, 400);
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-broker-webhook`;

      const { data: channel, error: upsertErr } = await sb.from("broker_whatsapp_channels").upsert({
        organization_id: orgId,
        user_id: userId,
        instance_name: instanceName,
        status: "connecting",
        webhook_url: webhookUrl,
      }, { onConflict: "organization_id,user_id" }).select().single();
      if (upsertErr) throw upsertErr;

      let instanceExists = false;
      let token = channel?.instance_token ?? null;

      try {
        const fetchRes = await provider.fetchInstances();
        const fetchRaw = fetchRes.raw;
        const fetchData = fetchRes.data;
        if (fetchRes.ok) {
          const list = Array.isArray(fetchData) ? fetchData : Array.isArray(fetchData?.instances) ? fetchData.instances : (Array.isArray(fetchData?.data) ? fetchData.data : []);
          const existingEvo = list.find((i: any) => (i?.name ?? i?.instanceName ?? i?.instance?.instanceName) === instanceName);
          if (existingEvo) {
            instanceExists = true;
            token = existingEvo?.token ?? existingEvo?.instance?.token ?? token;
          }
        }
      } catch (e) {
        console.warn("fetchInstances failed for broker channel:", e);
      }

      if (!instanceExists) {
        const createRes = await provider.createInstance(instanceName);
        const createRaw = createRes.raw;
        const createData = createRes.data;

        if (!createRes.ok) {
          if (!/already in use|already exists|em uso|já existe/i.test(createRaw)) {
            await sb.from("broker_whatsapp_channels").update({ status: "disconnected" }).eq("id", channel.id);
            await captureWhatsAppException(new Error("broker_create_instance_failed"), { flow: "broker_whatsapp", action: "create_instance", status: createRes.status, instance_name: instanceName });
            throw new Error(`Falha ao criar instância: ${createRaw.substring(0, 200)}`);
          }
          instanceExists = true;
        }

        token = createData?.hash?.apikey || createData?.token || createData?.instance?.token || token;
        
        // Configurar webhook logo após criar
        if (createRes.ok) {
            await provider.setWebhook(instanceName, webhookUrl, Deno.env.get("WHATSAPP_AGENT_SECRET") || "");
        }
      }

      const connRes = usePairing 
        ? await provider.pair(instanceName, rawPhone)
        : await provider.getQr(instanceName);

      const connRaw = connRes.raw;
      const connData = connRes.data;
      const pairingCode = extractPairingCode(connData);
      const qrCode = extractQrBase64(connData);


      const stateText = classifyConnectionStatus(connRaw, connData?.instance?.state, connData?.state);
      const status = stateText === "connected" ? "connected" : "connecting";

      await sb.from("broker_whatsapp_channels").update({
        instance_token: token,
        webhook_url: webhookUrl,
        qr_code: qrCode,
        phone_number: usePairing ? rawPhone : null,
        status,
      }).eq("id", channel.id);

      return json({
        status,
        qr_code: qrCode,
        pairing_code: pairingCode,
        instance_name: instanceName,
        instance_created: !instanceExists,
      });
    }

    // ── DISCONNECT ──
    if (action === "disconnect") {
      const channel = await getBrokerChannel(body.targetUserId);
      if (!channel) return json({ status: "disconnected" });

      // Check permission: own channel or admin
      if (channel.user_id !== userId && !isAdmin) return json({ error: "Sem permissão" }, 403);

      if (channel.instance_name) {
        try {
          const res = await fetch(`${EVOLUTION_API_URL}/instance/logout/${channel.instance_name}`, {
            method: "DELETE",
            headers: { apikey: EVOLUTION_API_KEY },
          });
          await res.text();
        } catch (e) {
          console.warn("Evolution logout failed:", e);
        }
      }

      await sb.from("broker_whatsapp_channels").update({ status: "disconnected", qr_code: null }).eq("id", channel.id);
      return json({ status: "disconnected" });
    }

    // ── DELETE ──
    if (action === "delete") {
      const channel = await getBrokerChannel(body.targetUserId);
      if (!channel) return json({ deleted: true, skipped: "not_found" });

      if (channel.user_id !== userId && !isAdmin) return json({ error: "Sem permissão" }, 403);

      if (channel.instance_name) {
        try {
          const res = await fetch(`${EVOLUTION_API_URL}/instance/delete/${channel.instance_name}`, {
            method: "DELETE",
            headers: { apikey: EVOLUTION_API_KEY },
          });
          await res.text();
        } catch (e) {
          console.warn("Evolution delete failed:", e);
        }
      }

      await sb.from("broker_whatsapp_channels").update({
        instance_name: null,
        instance_token: null,
        status: "disconnected",
        phone_number: null,
        qr_code: null,
        webhook_url: null,
      }).eq("id", channel.id);

      return json({ deleted: true });
    }

    return json({ error: "Invalid action. Supported: status, connect, disconnect, delete" }, 400);
  } catch (err: unknown) {
    console.error("whatsapp-broker-instance error:", err);
    await captureWhatsAppException(err, { action: "unexpected", flow: "broker_whatsapp", route: "whatsapp-broker-instance" });
    const message = err instanceof Error ? err.message : "Erro interno";
    return json({ error: message }, 500);
  }
});
