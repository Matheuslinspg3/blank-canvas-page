import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const classifyStatus = (...values: unknown[]): "connected" | "connecting" | "disconnected" | "unknown" => {
  const text = values.map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean).join(" ");
  if (!text) return "unknown";
  if (/(^|[^a-z])(open|connected|online|ready)([^a-z]|$)/.test(text)) return "connected";
  if (/(connecting|pairing|pair|qr|qrcode|scan|await|starting|sync|opening)/.test(text)) return "connecting";
  if (/(disconnected|close|closed|logout|logged.?out|offline|removed|delete)/.test(text)) return "disconnected";
  return "unknown";
};

const extractPhone = (payload: any): string | null => {
  for (const c of [
    payload?.phone, payload?.number, payload?.phoneNumber,
    payload?.instance?.phone, payload?.instance?.number,
    payload?.data?.phone, payload?.data?.number,
  ]) {
    if (c == null) continue;
    const d = String(c).replace(/\D/g, "");
    if (d.length >= 10) return d;
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const EVOLUTION_API_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "").replace(/\/$/, "");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");
    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) throw new Error("Evolution API not configured");

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
        const evoRes = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${channel.instance_name}`, {
          headers: { apikey: EVOLUTION_API_KEY },
        });
        const evoRaw = await evoRes.text();
        let evoData: any = null;
        try { evoData = JSON.parse(evoRaw); } catch {}

        if (evoRes.ok) {
          const evoStatus = classifyStatus(evoRaw, evoData?.state, evoData?.instance?.state);
          if (evoStatus !== "unknown") newStatus = evoStatus;
          phone = extractPhone(evoData) ?? phone;
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
      // Assistente cannot connect
      const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", userId);
      const roleList = (roles ?? []).map((r: any) => r.role);
      if (roleList.includes("assistente") && roleList.length === 1) {
        return json({ error: "Assistentes não podem conectar WhatsApp individual" }, 403);
      }

      // Get org slug for instance naming
      const { data: org } = await sb.from("organizations").select("slug, name").eq("id", orgId).single();
      const orgSlug = org?.slug || orgId.substring(0, 8);
      const userShort = userId.substring(0, 8);
      const instanceName = `broker_${orgSlug}_${userShort}`;

      // Upsert channel record
      const { data: channel, error: upsertErr } = await sb.from("broker_whatsapp_channels").upsert({
        organization_id: orgId,
        user_id: userId,
        instance_name: instanceName,
        status: "connecting",
      }, { onConflict: "organization_id,user_id" }).select().single();

      if (upsertErr) throw upsertErr;

      // Create instance on Evolution API
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-broker-webhook`;

      try {
        const createRes = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
          method: "POST",
          headers: { apikey: EVOLUTION_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceName,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            webhook: {
              url: webhookUrl,
              enabled: true,
              events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED"],
              webhook_by_events: false,
            },
          }),
        });

        const createData = await createRes.json();
        console.log("Evolution create response:", JSON.stringify(createData).substring(0, 500));

        const token = createData?.hash?.apikey || createData?.token || createData?.instance?.token || null;
        const qrCode = createData?.qrcode?.base64 || createData?.qr || createData?.base64 || null;

        await sb.from("broker_whatsapp_channels").update({
          instance_token: token,
          webhook_url: webhookUrl,
          qr_code: qrCode,
          status: qrCode ? "connecting" : "connecting",
        }).eq("id", channel.id);

        return json({ status: "connecting", qr_code: qrCode, instance_name: instanceName });
      } catch (e) {
        console.error("Evolution create failed:", e);
        await sb.from("broker_whatsapp_channels").update({ status: "disconnected" }).eq("id", channel.id);
        throw new Error("Falha ao criar instância no Evolution API");
      }
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
    const message = err instanceof Error ? err.message : "Erro interno";
    return json({ error: message }, 500);
  }
});
