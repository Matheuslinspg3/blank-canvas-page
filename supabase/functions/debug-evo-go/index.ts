import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { EVO_GO_BASE_URL } from "../_shared/evo-go.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const instanceId = url.searchParams.get("instance_id") || "";
  const token = url.searchParams.get("token") || instanceId;
  const path = url.searchParams.get("path") || "/session/status";
  const method = (url.searchParams.get("method") || "GET").toUpperCase();
  const headerMode = url.searchParams.get("hmode") || "bearer-instance-token";

  const headers: Record<string, string> = { "Content-Type": "application/json", "Instance-Id": instanceId };
  if (headerMode === "bearer-instance-token") headers["Authorization"] = `Bearer ${token}`;
  if (headerMode === "apikey-instance-token") headers["apikey"] = token;
  if (headerMode === "token-header") headers["token"] = token;
  if (headerMode === "x-instance-token") headers["X-Instance-Token"] = token;

  let body: string | undefined;
  if (method !== "GET") {
    try { body = await req.text(); } catch { body = undefined; }
    if (!body) body = "{}";
  }

  const res = await fetch(`${EVO_GO_BASE_URL}${path}`, { method, headers, body });
  const raw = await res.text();
  return new Response(JSON.stringify({
    sent_headers: headers,
    url: `${EVO_GO_BASE_URL}${path}`,
    status: res.status,
    raw: raw.slice(0, 2000),
  }, null, 2), { headers: { "content-type": "application/json" } });
});
