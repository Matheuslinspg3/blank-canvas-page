const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function test() {
  const res = await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      apikey: apiKey,
      "instance-name": "lovable"
    },
    body: JSON.stringify({ integration: "WHATSAPP-BAILEYS" }),
  });
  const raw = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${raw.substring(0, 500)}`);
}

await test();
