import { handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";
import { json, errorResponse } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const sb = createServiceClient();
  const orgId = "cdf3f0e6-da64-4090-bc76-1758796bea28";
  const instance = "porto-caicara-imoveis-ltda-cdf3f0e6-da64-4090-bc76-1758796bea28";
  const jid = "5513996666432@s.whatsapp.net";
  const ts26h = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
  const ts25h = new Date(Date.now() - 25 * 3600 * 1000).toISOString();

  const results: string[] = [];

  // 1) Inbound message
  const { error: e1 } = await sb.from("whatsapp_messages").insert({
    organization_id: orgId,
    instance_name: instance,
    remote_jid: jid,
    from_me: false,
    message_text: "Boa tarde, tenho interesse no apartamento de 3 quartos. Qual o valor?",
    message_type: "text",
    message_id: "test-inbound-followup-001",
    timestamp: ts26h,
    sender_type: "customer",
  });
  results.push(e1 ? `msg_in: ${e1.message}` : "msg_in: OK");

  // 2) Outbound message
  const { error: e2 } = await sb.from("whatsapp_messages").insert({
    organization_id: orgId,
    instance_name: instance,
    remote_jid: jid,
    from_me: true,
    message_text: "Olá! Vi que você se interessou pelo apartamento na Rua das Flores. Posso te ajudar com mais informações?",
    message_type: "text",
    message_id: "test-outbound-followup-001",
    timestamp: ts25h,
    sender_type: "agent",
  });
  results.push(e2 ? `msg_out: ${e2.message}` : "msg_out: OK");

  // 3) Follow-up queue
  const { error: e3 } = await sb.from("follow_up_queue").upsert({
    org_id: orgId,
    lead_phone: jid,
    lead_name: "Teste Follow-up (13996666432)",
    property_interest: "Apartamento 3Q - Rua das Flores",
    conversation_context: "Cliente perguntou sobre apartamento de 3 quartos. Agente respondeu com informações. Sem resposta há 25h.",
    instance_name: instance,
    status: "pending",
    attempt_count: 0,
    next_followup_at: new Date().toISOString(),
    last_outbound_at: ts25h,
    opted_out: false,
  }, { onConflict: "org_id,lead_phone" });
  results.push(e3 ? `queue: ${e3.message}` : "queue: OK");

  return json({ results });
});
