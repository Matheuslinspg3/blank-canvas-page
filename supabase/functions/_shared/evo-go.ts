/**
 * Evolution GO (EvoGo / whatsmeow) HTTP client.
 *
 * Convenção da API EvoGo:
 *  - Base URL: EVOLUTION_GO_URL
 *  - Autenticação: header `Instance-Id: <instanceId>` (o próprio InstanceId autoriza).
 *    Quando EVOLUTION_GO_TOKEN está setado, também enviamos `Authorization: Bearer <token>`.
 *  - Instância NÃO vai mais no path. Vai no header `Instance-Id`.
 *  - Endpoints principais:
 *      POST /send/text     { number, text, delay?, quoted?, mentionedJid? }
 *      POST /send/media    { number, url, type: "image"|"video"|"document"|"audio", caption?, filename?, delay? }
 *      POST /message/downloadimage  { messageId, ... }
 */

const GO_URL = (Deno.env.get("EVOLUTION_GO_URL") ?? "").trim();
const FALLBACK_URL = (Deno.env.get("EVOLUTION_API_URL") ?? "").trim();
const RAW_URL = GO_URL || FALLBACK_URL;
const GO_TOKEN = (Deno.env.get("EVOLUTION_GO_TOKEN") ?? "").trim();
const GLOBAL_KEY = (Deno.env.get("EVOLUTION_API_GLOBAL_KEY") ?? "").trim();
const TOKEN = GO_TOKEN || GLOBAL_KEY;

export const EVO_GO_BASE_URL = RAW_URL.replace(/\/$/, "");
export const EVO_GO_TOKEN = TOKEN;
export const EVO_GO_USING_FALLBACK = !GO_URL && !!FALLBACK_URL;

console.log(`[evo-go] init: using ${GO_URL ? "EVOLUTION_GO_URL" : (FALLBACK_URL ? "EVOLUTION_API_URL fallback" : "NONE")}=${EVO_GO_BASE_URL} go_token=${GO_TOKEN ? "set" : "missing"} global_key=${GLOBAL_KEY ? "set" : "missing"}`);

export interface EvoGoResponse {
  ok: boolean;
  status: number;
  data: any;
  raw: string;
}

function baseHeaders(instanceId?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (instanceId) h["Instance-Id"] = instanceId;
  return h;
}

function buildHeaderCandidates(instanceId?: string): Record<string, string>[] {
  const candidates: Record<string, string>[] = [];
  const seen = new Set<string>();
  const add = (headers: Record<string, string>) => {
    const key = JSON.stringify(Object.entries(headers).sort());
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(headers);
    }
  };

  for (const token of [GO_TOKEN, GLOBAL_KEY].filter(Boolean)) {
    add({ ...baseHeaders(instanceId), Authorization: `Bearer ${token}` });
  }
  for (const token of [GLOBAL_KEY, GO_TOKEN].filter(Boolean)) {
    add({ ...baseHeaders(instanceId), apikey: token });
  }
  add(baseHeaders(instanceId));

  return candidates;
}

export async function evoGoRequest(
  method: string,
  path: string,
  opts: { instanceId?: string; body?: any } = {},
): Promise<EvoGoResponse> {
  if (!EVO_GO_BASE_URL) {
    return {
      ok: false,
      status: 500,
      data: { message: "EVOLUTION_GO_URL not configured" },
      raw: "EVOLUTION_GO_URL not configured",
    };
  }
  const url = `${EVO_GO_BASE_URL}${path}`;
  console.log(`[evo-go] ${method} ${url} instanceId=${opts.instanceId ?? "none"}`);
  try {
    let last: EvoGoResponse | null = null;
    for (const headers of buildHeaderCandidates(opts.instanceId)) {
      const authType = headers["Authorization"] ? "Bearer" : (headers["apikey"] ? "apikey" : "none");
      const hasInst = !!headers["Instance-Id"];
      
      const res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
      last = { ok: res.ok, status: res.status, data, raw };

      if (res.ok) {
        return last;
      }

      console.warn(`[evo-go] attempt failed status=${res.status} auth=${authType} hasInst=${hasInst} raw=${raw.slice(0, 200)}; trying next candidate`);
    }

    console.error(`[evo-go] all auth attempts failed for ${method} ${url}. final status=${last?.status} raw=${last?.raw?.slice(0, 300)}`);
    return last!;
  } catch (e: any) {
    return { ok: false, status: 500, data: { message: String(e) }, raw: String(e) };
  }
}

/* ------- High-level helpers ------- */

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
  payload: { number: string; text: string; delay?: number; mentionedJid?: string[] },
): Promise<EvoGoResponse> {
  // Try Evolution Go path first
  let res = await evoGoRequest("POST", "/send/text", { instanceId, body: payload });
  
  if (!res.ok && (res.status === 404 || res.status === 401 || res.status === 405)) {
    console.log(`[evo-go] /send/text failed (${res.status}), trying v2 paths`);
    
    // Try Evolution API v2 standard path
    res = await evoGoRequest("POST", `/message/sendText/${instanceId}`, { instanceId, body: payload });
  }
  return res;
}

export async function evoGoSendMedia(
  instanceId: string,
  payload: EvoMediaPayload,
): Promise<EvoGoResponse> {
  // Candidate 1: Evolution Go (whatsmeow/wuzapi) format
  const bodyGo: any = {
    number: payload.number,
    url: payload.url,
    type: payload.type ?? "image",
    caption: payload.caption || "",
  };
  if (payload.filename) bodyGo.filename = payload.filename;
  if (payload.delay !== undefined) bodyGo.delay = payload.delay;

  // Candidate 2: Evolution API v2 format (Flat)
  const bodyV2: any = {
    number: payload.number,
    mediatype: payload.type ?? "image",
    media: payload.url,
    caption: payload.caption || "",
  };

  // Candidate 3: Evolution API v2 format (Nested mediaMessage)
  const bodyV2Nested: any = {
    number: payload.number,
    mediaMessage: {
      mediatype: payload.type ?? "image",
      media: payload.url,
      caption: payload.caption || "",
    }
  };

  // 1. Try Evolution Go (whatsmeow)
  let res = await evoGoRequest("POST", "/send/media", { instanceId, body: bodyGo });
  if (res.ok) return res;

  // 2. Try Evolution API v2 standard path (/message/sendMedia)
  if (!res.ok && (res.status === 404 || res.status === 401 || res.status === 405)) {
    console.log(`[evo-go] /send/media failed (${res.status}), trying /message/sendMedia`);
    res = await evoGoRequest("POST", `/message/sendMedia/${instanceId}`, { instanceId, body: bodyV2 });
    if (!res.ok && res.status === 400) {
      res = await evoGoRequest("POST", `/message/sendMedia/${instanceId}`, { instanceId, body: bodyV2Nested });
    }
    if (res.ok) return res;
  }

  // 3. Try Evolution API v2 legacy image path (/message/image)
  if (!res.ok && (payload.type === "image" || !payload.type) && (res.status === 404 || res.status === 405)) {
    console.log(`[evo-go] trying /message/image`);
    res = await evoGoRequest("POST", `/message/image/${instanceId}`, { instanceId, body: bodyV2 });
    if (res.ok) return res;
  }

  // 4. Try Evolution API v2 legacy media path (/message/media)
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    console.log(`[evo-go] trying /message/media`);
    res = await evoGoRequest("POST", `/message/media/${instanceId}`, { instanceId, body: bodyV2 });
  }

  return res;
}

export async function evoGoSendAudio(
  instanceId: string,
  payload: { number: string; url: string; delay?: number },
): Promise<EvoGoResponse> {
  return evoGoSendMedia(instanceId, { ...payload, type: "audio" });
}

export async function evoGoDownloadImage(
  instanceId: string,
  body: Record<string, any>,
): Promise<EvoGoResponse> {
  return evoGoRequest("POST", "/message/downloadimage", { instanceId, body });
}

/** Extracts the message id from common EvoGo response shapes. */
export function evoGoExtractMessageId(data: any): string | null {
  return (
    data?.key?.id ??
    data?.messageId ??
    data?.id ??
    data?.message?.id ??
    null
  );
}

export interface EvoInstanceConfig {
  organization_id: string;
  instance_name: string;
  status: string;
}

/**
 * Resolves instance configuration from various sources:
 * 1. whatsapp_agent_config (instance_name or organization_id)
 * 2. whatsapp_connections (instance_name or organization_id)
 */
export async function resolveEvoConfig(
  sb: SupabaseClient,
  identifier: string
): Promise<EvoInstanceConfig | null> {
  const instTrim = identifier.trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instTrim);

  let config: any = null;

  // 1) whatsapp_agent_config by instance_name
  {
    const { data } = await sb
      .from("whatsapp_agent_config")
      .select("organization_id, instance_name, status")
      .eq("instance_name", instTrim)
      .maybeSingle();
    if (data) config = data;
  }

  // 2) whatsapp_agent_config by organization_id (UUID)
  if (!config && isUuid) {
    const { data } = await sb
      .from("whatsapp_agent_config")
      .select("organization_id, instance_name, status")
      .eq("organization_id", instTrim)
      .maybeSingle();
    if (data) config = data;
  }

  // 3) whatsapp_connections by instance_name
  if (!config || !config.instance_name) {
    const { data } = await sb
      .from("whatsapp_connections")
      .select("organization_id, instance_name, status")
      .eq("instance_name", instTrim)
      .maybeSingle();
    if (data) config = { ...(config || {}), ...data };
  }

  // 4) whatsapp_connections by organization_id (UUID)
  if ((!config || !config.instance_name) && isUuid) {
    const { data } = await sb
      .from("whatsapp_connections")
      .select("organization_id, instance_name, status")
      .eq("organization_id", instTrim)
      .order("status", { ascending: true }) // connected usually < others
      .limit(10);
    
    const list = data || [];
    const connected = list.find((r: any) => r.status === "connected");
    const chosen = connected || list[0];
    if (chosen) config = { ...(config || {}), ...chosen };
  }

  if (!config?.instance_name) return null;

  return {
    organization_id: config.organization_id,
    instance_name: config.instance_name,
    status: config.status
  };
}
