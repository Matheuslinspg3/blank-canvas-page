
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_GLOBAL_KEY;

if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY) {
  console.error("Missing EVOLUTION_API_URL or EVOLUTION_API_GLOBAL_KEY");
  process.exit(1);
}

const baseUrl = EVOLUTION_API_URL.replace(/\/$/, "");

async function testCreate(payload: any, label: string) {
  console.log(`\n--- Testing: ${label} ---`);
  console.log(`Payload: ${JSON.stringify(payload)}`);
  
  try {
    const res = await fetch(`${baseUrl}/instance/create`, {
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
    console.log(`Response: ${text.substring(0, 1000)}`);
    
    if (res.ok) {
       console.log("Creation successful!");
       const name = payload.name || payload.instanceName;
       await fetch(`${baseUrl}/instance/delete/${name}`, {
         method: "DELETE",
         headers: { "apikey": EVOLUTION_API_KEY }
       });
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

const finalName = "final-diag-" + Math.random().toString(36).substring(2, 10);
await testCreate({
  name: finalName,
  token: "token-" + Math.random().toString(36).substring(2, 15),
  integration: "WHATSAPP-BAILEYS",
  qrcode: true,
  syncFullHistory: false
}, "Final structure: name + token + WHATSAPP-BAILEYS");
