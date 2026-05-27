import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { evoGoRequest, EVO_GO_BASE_URL } from "../_shared/evo-go.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const instanceId = url.searchParams.get("instance_id") || undefined;
  const path = url.searchParams.get("path") || "/instance/all";

  const res = await evoGoRequest("GET", path, { instanceId });
  return new Response(JSON.stringify({
    base_url: EVO_GO_BASE_URL,
    request_path: path,
    instance_id_sent: instanceId ?? null,
    status: res.status,
    ok: res.ok,
    data: res.data,
    raw: res.raw?.slice(0, 2000),
  }, null, 2), { headers: { "content-type": "application/json" }, status: 200 });
});
