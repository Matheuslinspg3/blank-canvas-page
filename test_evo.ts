
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

// 4. Minimal
await testCreate({
  instanceName: instanceName + "-4"
}, "Minimal instanceName");

// 5. Minimal with integration lowercase
await testCreate({
  instanceName: instanceName + "-5",
  integration: "whatsapp-baileys"
}, "Minimal with integration lowercase");

// 6. Using 'name' instead of 'instanceName' in a different way
await testCreate({
  name: instanceName + "-6",
  integration: "WHATSAPP-BAILEYS"
}, "Only name with integration");

