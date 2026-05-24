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
await test("instanceName (camel)", { instanceName, integration: "WHATSAPP-BAILEYS" });
await test("instance_name (snake)", { instance_name: instanceName + "-s", integration: "WHATSAPP-BAILEYS" });
await test("name", { name: instanceName + "-n", integration: "WHATSAPP-BAILEYS" });
await test("instanceName + name", { instanceName: instanceName + "-b", name: instanceName + "-b", integration: "WHATSAPP-BAILEYS" });
