const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function test() {
  const instanceName = "test-no-sync-" + Math.random().toString(36).substring(2, 7);
  const payload = { 
    instanceName, 
    name: instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true,
    syncFullHistory: false // Try with false
  };
  
  const res = await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${raw.substring(0, 500)}`);
}

await test();
