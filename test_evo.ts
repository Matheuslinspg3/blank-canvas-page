const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

if (!baseUrl || !apiKey) {
  console.error("Missing env vars");
  Deno.exit(1);
}

const instanceName = "test-lovable-" + Math.random().toString(36).substring(2, 7);

async function test(payload: any) {
  console.log(`Testing payload: ${JSON.stringify(payload)}`);
  const res = await fetch(`${baseUrl}/instance/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${raw}`);
  return res.ok;
}

console.log("--- Test 1: instanceName ---");
await test({ instanceName });

console.log("\n--- Test 2: name ---");
await test({ name: instanceName + "-2" });

console.log("\n--- Test 3: both ---");
await test({ instanceName: instanceName + "-3", name: instanceName + "-3" });
