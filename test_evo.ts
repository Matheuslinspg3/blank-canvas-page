const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function test() {
  const instanceName = "test-query-only-" + Math.random().toString(36).substring(2, 7);
  console.log(`Testing with query param and integration in body for ${instanceName}`);
  const res = await fetch(`${baseUrl}/instance/create?instanceName=${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ integration: "WHATSAPP-BAILEYS" }),
  });
  const raw = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${raw.substring(0, 500)}`);
}

await test();
