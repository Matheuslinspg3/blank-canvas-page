import { supabase } from "@/integrations/supabase/client";

export type WhatsAppAction = "create" | "reconnect" | "disconnect";
export type WhatsAppSource = "ai_agent" | "broker_whatsapp";

export interface WhatsAppWebhookPayload {
  action: WhatsAppAction;
  channel: "whatsapp";
  source: WhatsAppSource;
  orgId: string;
  orgName: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  phoneNumber?: string;
  brokerId?: string;
  timestamp: string;
  environment?: string;
}

export interface WhatsAppWebhookResponse {
  ok: boolean;
  message: string;
  data: any;
  error: string;
  qrCode: string;
  pairingCode: string;
}

/**
 * @deprecated Use Supabase Edge Function 'whatsapp-n8n-controller' instead.
 */
export async function sendWhatsAppWebhook(payload: any): Promise<any> {
  console.warn("[WhatsAppWebhook] sendWhatsAppWebhook is deprecated. Use useWhatsAppV2 hook.");
  return { ok: false, error: "Deprecated. Use useWhatsAppV2." };
}

/**
 * @deprecated Use Supabase Edge Function 'whatsapp-n8n-controller' instead.
 */
export function buildWhatsAppPayload(
  action: string,
  source: string,
  context: any
): any {
  console.warn("[WhatsAppWebhook] buildWhatsAppPayload is deprecated.");
  return {};
}
