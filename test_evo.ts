const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function test(label: string, payload: any) {
  console.log(`\n--- ${label} ---`);
  const res = await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${raw.substring(0, 500)}`);
}

const instanceName = "test-" + Math.random().toString(36).substring(2, 7);
await test("Minimal name + integration", { name: instanceName, integration: "WHATSAPP-BAILEYS" });
await test("Minimal instanceName + integration", { instanceName: instanceName + "-in", integration: "WHATSAPP-BAILEYS" });
