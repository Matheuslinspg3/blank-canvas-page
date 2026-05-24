const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function test() {
  const instanceName = "test-name-only";
  await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ name: instanceName, integration: "WHATSAPP-BAILEYS" }),
  });
  
  const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
    method: "GET",
    headers: { apikey: apiKey },
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

await test();
