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

const RAW_URL = (Deno.env.get("EVOLUTION_GO_URL") ?? Deno.env.get("EVOLUTION_API_URL") ?? "").trim();
const GO_TOKEN = (Deno.env.get("EVOLUTION_GO_TOKEN") ?? "").trim();
const GLOBAL_KEY = (Deno.env.get("EVOLUTION_API_GLOBAL_KEY") ?? "").trim();
const TOKEN = GO_TOKEN || GLOBAL_KEY;

export const EVO_GO_BASE_URL = RAW_URL.replace(/\/$/, "");
export const EVO_GO_TOKEN = TOKEN;

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
  try {
    let last: EvoGoResponse | null = null;
    for (const headers of buildHeaderCandidates(opts.instanceId)) {
      const res = await fetch(url, {
        method,
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      const raw = await res.text();
      let data: any = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
      last = { ok: res.ok, status: res.status, data, raw };

      if (res.ok || ![401, 403].includes(res.status)) return last;
      console.warn(`[evo-go] auth attempt failed status=${res.status}; trying fallback credentials/header`);
    }
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
  return evoGoRequest("POST", "/send/text", { instanceId, body: payload });
}

export async function evoGoSendMedia(
  instanceId: string,
  payload: EvoMediaPayload,
): Promise<EvoGoResponse> {
  const body: any = {
    number: payload.number,
    url: payload.url,
    type: payload.type ?? "image",
  };
  if (payload.caption !== undefined) body.caption = payload.caption;
  if (payload.filename) body.filename = payload.filename;
  if (payload.delay !== undefined) body.delay = payload.delay;
  if (payload.mentionedJid?.length) body.mentionedJid = payload.mentionedJid;
  if (payload.mentionAll) body.mentionAll = true;
  return evoGoRequest("POST", "/send/media", { instanceId, body });
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
