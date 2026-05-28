/**
 * Evolution GO (whatsmeow) HTTP client.
 *
 * Auth contract (verified against Evolution GO Postman docs):
 *   - Header: `apikey: <GLOBAL_API_KEY>`
 *   - Header: `instanceId: <instance UUID/name>` for routes operating on an instance.
 *
 * Endpoints:
 *   POST /send/text     { number, text, ... }
 *   POST /send/media    { number, url, type, caption?, ... }
 *   GET  /instance/all  (admin)
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const GO_URL = (Deno.env.get("EVOLUTION_GO_URL") ?? "").trim();
const FALLBACK_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "").trim();
const RAW_URL = GO_URL || FALLBACK_URL;
const GO_TOKEN = (Deno.env.get("EVOLUTION_GO_TOKEN") ?? "").trim();
const GLOBAL_KEY_ENV = (Deno.env.get("EVOLUTION_API_GLOBAL_KEY") ?? "").trim();

export const EVO_GO_BASE_URL = RAW_URL.replace(/\/$/, "");
export const EVO_GO_GLOBAL_KEY = GO_TOKEN || GLOBAL_KEY_ENV;

console.log(`[evo-go] init: base=${EVO_GO_BASE_URL} global_key=${EVO_GO_GLOBAL_KEY ? `set(${EVO_GO_GLOBAL_KEY.slice(0,5)}...)` : "missing"}`);

export interface EvoGoResponse {
  ok: boolean;
  status: number;
  data: any;
  raw: string;
}

export async function evoGoRequest(
  method: string,
  path: string,
  opts: { apikey?: string; instanceId?: string; body?: any } = {},
): Promise<EvoGoResponse> {
  if (!EVO_GO_BASE_URL) {
    return { ok: false, status: 500, data: { message: "EVOLUTION_GO_URL not configured" }, raw: "EVOLUTION_GO_URL not configured" };
  }
  const url = `${EVO_GO_BASE_URL}${path}`;
  const apikey = (opts.apikey ?? "").trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apikey) headers["apikey"] = apikey;
  if (opts.instanceId) headers["instanceId"] = opts.instanceId;

  console.log(`[evo-go] ${method} ${url} apikey=${apikey ? apikey.slice(0,5) + "..." : "none"} instanceId=${opts.instanceId || "none"}`);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const raw = await res.text();
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
    if (!res.ok) {
      console.warn(`[evo-go] ${method} ${path} -> ${res.status}: ${raw.slice(0, 200)}`);
    }
    return { ok: res.ok, status: res.status, data, raw };
  } catch (e: any) {
    return { ok: false, status: 500, data: { message: String(e) }, raw: String(e) };
  }
}

/* ---- Admin helpers (use global key) ---- */

export async function evoGoListInstances(): Promise<EvoGoResponse> {
  return evoGoRequest("GET", "/instance/all", { apikey: EVO_GO_GLOBAL_KEY });
}

/* ---- High-level send helpers (use instance token) ---- */

export interface EvoMediaPayload {
  number: string;
  url: string;
  type?: "image" | "video" | "document" | "audio";
  caption?: string;
  filename?: string;
  delay?: number;
  mentionedJid?: string[];
  mentionAll?: boolean;
}

export async function evoGoSendText(
  instanceId: string,
  instanceToken: string,
  payload: { number: string; text: string; delay?: number; mentionedJid?: string[] },
): Promise<EvoGoResponse> {
  return evoGoRequest("POST", "/send/text", { apikey: instanceToken, instanceId, body: payload });
}

export async function evoGoSendMedia(
  instanceId: string,
  instanceToken: string,
  payload: EvoMediaPayload,
): Promise<EvoGoResponse> {
  const body: any = {
    number: payload.number,
    url: payload.url,
    type: payload.type ?? "image",
    caption: payload.caption || "",
  };
  if (payload.filename) body.filename = payload.filename;
  if (payload.delay !== undefined) body.delay = payload.delay;
  if (payload.mentionedJid) body.mentionedJid = payload.mentionedJid;
  if (payload.mentionAll) body.mentionAll = payload.mentionAll;
  return evoGoRequest("POST", "/send/media", { apikey: instanceToken, instanceId, body });
}

export async function evoGoSendAudio(
  instanceId: string,
  instanceToken: string,
  payload: { number: string; url: string; delay?: number },
): Promise<EvoGoResponse> {
  return evoGoSendMedia(instanceId, instanceToken, { ...payload, type: "audio" });
}

export async function evoGoDownloadImage(
  instanceId: string,
  body: Record<string, any>,
): Promise<EvoGoResponse> {
  return evoGoRequest("POST", "/message/downloadimage", { apikey: EVO_GO_GLOBAL_KEY, instanceId, body });
}

export function evoGoExtractMessageId(data: any): string | null {
  return data?.key?.id ?? data?.messageId ?? data?.id ?? data?.message?.id ?? null;
}

/* ---- Config resolution ---- */

export interface EvoInstanceConfig {
  organization_id: string;
  instance_name: string;
  instance_token: string;
  status: string;
}

/**
 * Resolve the active Evolution GO instance for an org/instance identifier.
 *
 * Strategy:
 *   1. Look up `whatsapp_instances` (source of truth: holds instance_token).
 *   2. If token still missing/stale, refresh from /instance/all (admin) and
 *      upsert back into the DB.
 */
export async function resolveEvoConfig(
  sb: SupabaseClient,
  identifier: string,
): Promise<EvoInstanceConfig | null> {
  const idTrim = (identifier ?? "").trim();
  if (!idTrim) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idTrim);

  // Evolution GO's live instance list is the source of truth. Some DB rows can
  // remain connected with old instance names/tokens after reconnects.
  if (isUuid) {
    const live = await refreshInstancesForOrg(sb, idTrim);
    const connected = live?.find((r) => r.status === "connected") || live?.[0];
    if (connected?.instance_name && connected?.instance_token) {
      return {
        organization_id: idTrim,
        instance_name: connected.instance_name,
        instance_token: connected.instance_token,
        status: connected.status || "connected",
      };
    }
  }

  // 1) whatsapp_instances by instance_name
  let inst: any = null;
  {
    const { data } = await sb
      .from("whatsapp_instances")
      .select("organization_id, instance_name, instance_token, status")
      .eq("instance_name", idTrim)
      .maybeSingle();
    if (data) inst = data;
  }

  // 2) whatsapp_instances by organization_id (preferring connected)
  if (!inst && isUuid) {
    const { data } = await sb
      .from("whatsapp_instances")
      .select("organization_id, instance_name, instance_token, status")
      .eq("organization_id", idTrim)
      .order("status", { ascending: true })
      .limit(10);
    const list = data || [];
    inst = list.find((r: any) => r.status === "connected") || list[0] || null;
  }

  // 3) Fallback: legacy whatsapp_agent_config / whatsapp_connections (no token)
  let orgId = inst?.organization_id ?? null;
  let instanceName = inst?.instance_name ?? null;
  let status = inst?.status ?? null;

  if (!instanceName) {
    const { data: cfg } = await sb
      .from("whatsapp_agent_config")
      .select("organization_id, instance_name, instance_token, status")
      .or(`instance_name.eq.${idTrim}${isUuid ? `,organization_id.eq.${idTrim}` : ""}`)
      .maybeSingle();
    if (cfg) {
      orgId = orgId || cfg.organization_id;
      instanceName = instanceName || cfg.instance_name;
      status = status || cfg.status;
      if (cfg.instance_token && !inst?.instance_token) {
        inst = { ...(inst || {}), instance_token: cfg.instance_token };
      }
    }
  }

  if (!instanceName) {
    const { data: conn } = await sb
      .from("whatsapp_connections")
      .select("organization_id, instance_name, status")
      .or(`instance_name.eq.${idTrim}${isUuid ? `,organization_id.eq.${idTrim}` : ""}`)
      .order("status", { ascending: true })
      .limit(5);
    const list = conn || [];
    const chosen = list.find((r: any) => r.status === "connected") || list[0];
    if (chosen) {
      orgId = orgId || chosen.organization_id;
      instanceName = instanceName || chosen.instance_name;
      status = status || chosen.status;
    }
  }

  if (!orgId) return null;

  let token: string | null = inst?.instance_token ?? null;

  // 4) If no token (or instanceName), refresh from server using global key
  if (!token || !instanceName) {
    const refreshed = await refreshInstancesForOrg(sb, orgId);
    if (refreshed) {
      // Prefer the instance matching identifier; else connected; else first
      const match =
        refreshed.find((r) => r.instance_name === idTrim) ||
        refreshed.find((r) => r.status === "connected") ||
        refreshed[0];
      if (match) {
        instanceName = match.instance_name;
        token = match.instance_token;
        status = match.status || status;
      }
    }
  }

  if (!instanceName || !token) return null;

  return {
    organization_id: orgId,
    instance_name: instanceName,
    instance_token: token,
    status: status || "unknown",
  };
}

/**
 * Calls /instance/all with the GLOBAL_API_KEY, filters instances belonging to
 * the given organization (by name prefix/suffix containing the org UUID), and
 * upserts them into whatsapp_instances. Returns the matching rows.
 */
export async function refreshInstancesForOrg(
  sb: SupabaseClient,
  orgId: string,
): Promise<Array<{ instance_name: string; instance_token: string; status: string }> | null> {
  if (!EVO_GO_GLOBAL_KEY) {
    console.warn("[evo-go] refreshInstancesForOrg: no global key configured");
    return null;
  }
  const res = await evoGoListInstances();
  if (!res.ok) {
    console.warn(`[evo-go] /instance/all failed: ${res.status} ${res.raw.slice(0, 200)}`);
    return null;
  }
  // Server returns either {instances:[...]} or [...]
  const rawList: any[] = Array.isArray(res.data) ? res.data : (res.data?.instances ?? res.data?.data ?? []);
  const all = rawList.map((i: any) => ({
    instance_name: i.name || i.instanceName || i.instance_name || i.id,
    instance_token: i.token || i.apikey || i.instance_token,
    status: i.status || i.connection || (i.connected ? "connected" : "disconnected"),
    phone_number: i.phone || i.number || i.phoneNumber || null,
  })).filter((x) => x.instance_name && x.instance_token);

  // Match instances belonging to this org (name contains orgId or matches DB rows)
  const orgInstances = all.filter((x) => x.instance_name.includes(orgId));

  // Upsert into whatsapp_instances
  for (const inst of orgInstances) {
    await sb
      .from("whatsapp_instances")
      .upsert(
        {
          organization_id: orgId,
          instance_name: inst.instance_name,
          instance_token: inst.instance_token,
          status: inst.status,
          phone_number: inst.phone_number,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "instance_name" },
      );
  }

  return orgInstances.length ? orgInstances : null;
}
