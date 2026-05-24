const baseUrl = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
const apiKey = Deno.env.get("EVOLUTION_API_GLOBAL_KEY");

async function checkInstances() {
  const res = await fetch(`${baseUrl}/instance/fetchInstances`, {
    method: "GET",
    headers: { apikey: apiKey },
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

await checkInstances();
