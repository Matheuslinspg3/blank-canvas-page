const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

if (!baseUrl || !apiKey) {
  console.error("Missing env vars");
  Deno.exit(1);
}

async function test(label: string, payload: any) {
  console.log(`\n--- ${label} ---`);
  console.log(`Testing payload: ${JSON.stringify(payload)}`);
  try {
    const res = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(payload),
    });
    const raw = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${raw}`);
  } catch (e) {
    console.error(`Error: ${e}`);
  }
}

const instanceName = "test-lovable-" + Math.random().toString(36).substring(2, 7);

await test("instanceName + BAILEYS", { instanceName, integration: "BAILEYS" });
await test("instanceName + WHATSAPP-BAILEYS", { instanceName, integration: "WHATSAPP-BAILEYS" });
await test("name + BAILEYS", { name: instanceName + "-n", integration: "BAILEYS" });
await test("both + BAILEYS", { instanceName: instanceName + "-b", name: instanceName + "-b", integration: "BAILEYS" });
