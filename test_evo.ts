
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_GLOBAL_KEY;

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error("Missing EVOLUTION_API_URL or EVOLUTION_API_GLOBAL_KEY");
  process.exit(1);
}

const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");
const instanceName = "test-diag-" + Math.random().toString(36).substring(7);

async function testCreate(payload: any, label: string, customUrl?: string) {
  console.log(`\n--- Testing: ${label} ---`);
  const url = customUrl || `${baseUrl}/instance/create`;
  console.log(`URL: ${url}`);
  console.log(`Payload: ${JSON.stringify(payload)}`);
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "apikey": EVOLUTION_API_KEY 
      },
      body: JSON.stringify(payload),
    });

    
    const status = res.status;
    const text = await res.text();
    console.log(`Status: ${status}`);
    console.log(`Response: ${text.substring(0, 500)}`);
    
    if (res.ok) {
       // Clean up
       console.log("Cleaning up...");
       await fetch(`${baseUrl}/instance/delete/${payload.instanceName || payload.name}`, {
         method: "DELETE",
         headers: { "apikey": EVOLUTION_API_KEY }
       });
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

// 1. Current payload (approx)
await testCreate({
  instanceName,
  name: instanceName,
  integration: "WHATSAPP-BAILEYS",
  qrcode: true
}, "Both instanceName and name");

// 2. Only instanceName
await testCreate({
  instanceName: instanceName + "-2",
  integration: "WHATSAPP-BAILEYS",
  qrcode: true
}, "Only instanceName");

// 7. instanceName in URL query
await testCreate({
  integration: "WHATSAPP-BAILEYS"
}, "instanceName in URL query", `${baseUrl}/instance/create?instanceName=${instanceName}-7`);

// 8. Both in URL and body
await testCreate({
  instanceName: instanceName + "-8",
  integration: "WHATSAPP-BAILEYS"
}, "Both in URL and body", `${baseUrl}/instance/create?instanceName=${instanceName}-8`);

// 9. name in body, instanceName in URL
await testCreate({
  name: instanceName + "-9",
  integration: "WHATSAPP-BAILEYS"
}, "name in body, instanceName in URL", `${baseUrl}/instance/create?instanceName=${instanceName}-9`);

// 11. instanceName in path
await testCreate({
  integration: "WHATSAPP-BAILEYS",
  qrcode: true
}, "instanceName in path", `${baseUrl}/instance/create/${instanceName}-11`);

// 12. instanceName in path AND body
await testCreate({
  instanceName: instanceName + "-12",
  integration: "WHATSAPP-BAILEYS",
  qrcode: true
}, "instanceName in path AND body", `${baseUrl}/instance/create/${instanceName}-12`);

// 14. With long token
await testCreate({
  instanceName: instanceName + "-14",
  token: "token-long-enough-1234567890",
  integration: "WHATSAPP-BAILEYS"
}, "With long token");

// 15. Only instanceName and token
await testCreate({
  instanceName: instanceName + "-15",
  token: "token-long-enough-1234567890"
}, "Only instanceName and token");

// 16. What if it's 'instance_name' (lowercase with underscore)?
await testCreate({
  instance_name: instanceName + "-16",
  integration: "WHATSAPP-BAILEYS"
}, "instance_name with underscore");




