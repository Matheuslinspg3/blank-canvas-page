const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function test() {
  const instanceName = "test-empty-body-" + Math.random().toString(36).substring(2, 7);
  console.log(`Testing with empty body for ${instanceName}`);
  const res = await fetch(`${baseUrl}/instance/create?instanceName=${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({}),
  });
  const raw = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${raw.substring(0, 500)}`);
}

await test();
