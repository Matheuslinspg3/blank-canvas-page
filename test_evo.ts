const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function test() {
  const instanceName = "test-name-success-" + Math.random().toString(36).substring(2, 7);
  console.log(`Creating with name: ${instanceName}`);
  const res = await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ name: instanceName, integration: "WHATSAPP-BAILEYS" }),
  });
  const raw = await res.text();
  console.log(`Status: ${res.status}`);
  
  const fetchRes = await fetch(`${baseUrl}/instance/fetchInstances`, {
    method: "GET",
    headers: { apikey: apiKey },
  });
  const data = await fetchRes.json();
  console.log("Instances List:");
  console.log(JSON.stringify(data, null, 2));
}

await test();
