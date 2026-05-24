const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function test(url: string) {
  console.log(`\n--- Testing ${url} ---`);
  const res = await fetch(url, {
    method: "GET",
    headers: { apikey: apiKey },
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

await test(`${baseUrl}/instance/integrations`);
