import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const EVO_URL = Deno.env.get("EVOLUTION_GO_URL") || Deno.env.get("EVOLUTION_API_URL") || "";
const GLOBAL_KEY = Deno.env.get("EVOLUTION_API_GLOBAL_KEY") || Deno.env.get("EVOLUTION_GO_TOKEN") || "";

serve(async (req) => {
  const testPaths = [
    "/swagger/doc.json",
    "/swagger.json",
    "/doc.json",
    "/info",
    "/version"
  ];
  
  const results = [];
  for (const path of testPaths) {
    try {
      const res = await fetch(`${EVO_URL.replace(/\/$/, "")}${path}`, {
        headers: {
          "apikey": GLOBAL_KEY,
          "Authorization": `Bearer ${GLOBAL_KEY}`
        }
      });
      results.push({
        path,
        status: res.status,
        body: (await res.text()).slice(0, 500)
      });
    } catch (e) {
      results.push({ path, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ v: "v3", results }, null, 2), { headers: { "content-type": "application/json" } });
});
