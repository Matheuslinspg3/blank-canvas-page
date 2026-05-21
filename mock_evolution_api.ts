
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const port = 8888;
const handler = async (req: Request) => {
  const url = new URL(req.url);
  console.log(`[Mock Evo API] ${req.method} ${url.pathname}${url.search}`);

  if (url.pathname.includes("/instance/fetchInstances")) {
    return new Response(JSON.stringify([{
      instanceName: "broker_test_user",
      token: "test_token_123",
      status: "open"
    }]), { status: 200 });
  }

  if (url.pathname.includes("/instance/create")) {
    const body = await req.json();
    if (body.instanceName === "already_exists") {
      return new Response(JSON.stringify({ error: "already exists" }), { status: 403 });
    }
    return new Response(JSON.stringify({
      hash: { apikey: "new_token_456" },
      token: "new_token_456"
    }), { status: 201 });
  }

  if (url.pathname.includes("/instance/connect")) {
    return new Response(JSON.stringify({
      state: "connecting",
      qrcode: { base64: "test_qr_code_base64", pairingCode: "ABC12345" }
    }), { status: 200 });
  }

  return new Response("Not Found", { status: 404 });
};

console.log(`Mock Evolution API running on http://localhost:${port}`);
await serve(handler, { port });
