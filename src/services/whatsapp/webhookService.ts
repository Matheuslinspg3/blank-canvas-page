// @deprecated Use whatsapp-n8n-controller edge function via useWhatsAppV2.
export type WhatsAppAction = "create" | "reconnect" | "disconnect" | "status";
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
  message?: string;
  data?: any;
  error?: string;
  qrCode?: string;
  pairingCode?: string;
}

/** @deprecated Use whatsapp-n8n-controller edge function. */
export async function sendWhatsAppWebhook(_payload: any): Promise<WhatsAppWebhookResponse> {
  console.warn("[WhatsAppWebhook] deprecated. Use whatsapp-n8n-controller.");
  return { ok: false, message: "Deprecated. Use useWhatsAppV2." };
}

/** @deprecated */
export function buildWhatsAppPayload(_action: string, _source: string, _context: any): any {
  return {};
}
