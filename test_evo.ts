const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function test() {
  const instanceName = "test" + Math.random().toString(36).substring(2, 7);
  const payload = { 
    instanceName, 
    name: instanceName,
    integration: "WHATSAPP-BAILEYS",
    qrcode: true
  };
  
  console.log("Attempt 1...");
  let res = await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  console.log(`Status 1: ${res.status}`);
  
  if (!res.ok) {
    console.log("Attempt 2 after delay...");
    await new Promise(r => setTimeout(r, 1000));
    res = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(payload),
    });
    console.log(`Status 2: ${res.status}`);
  }
  
  const raw = await res.text();
  console.log(`Response: ${raw.substring(0, 500)}`);
}

await test();
