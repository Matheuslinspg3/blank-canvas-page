const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function test(label: string, url: string, payload: any) {
  console.log(`\n--- ${label} ---`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${raw.substring(0, 500)}`);
}

const instanceName = "test-" + Math.random().toString(36).substring(2, 7);
await test("Query param instanceName", `${baseUrl}/instance/create?instanceName=${instanceName}`, { integration: "WHATSAPP-BAILEYS", qrcode: true });
await test("Query param name", `${baseUrl}/instance/create?name=${instanceName}-q`, { integration: "WHATSAPP-BAILEYS", qrcode: true });
