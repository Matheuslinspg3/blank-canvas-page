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
  brokerId?: string;
  timestamp: string;
  environment?: string;
}

const N8N_WEBHOOK_URL = "https://n8n.costazul.shop/webhook/2089d8f5-252c-4eb8-9da6-58fbc694cf72whatsapp";

export async function sendWhatsAppWebhook(payload: WhatsAppWebhookPayload) {
  console.log(`[WhatsAppWebhook] Sending ${payload.action} for ${payload.source}`, payload);
  
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro no webhook (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error: any) {
    console.error("[WhatsAppWebhook] Error:", error);
    return { ok: false, error: error.message || "Erro ao processar requisição" };
  }
}

export function buildWhatsAppPayload(
  action: WhatsAppAction,
  source: WhatsAppSource,
  context: {
    user: any;
    profile: any;
    organization?: any;
    brokerId?: string;
  }
): WhatsAppWebhookPayload {
  const { user, profile, organization, brokerId } = context;

  return {
    action,
    channel: "whatsapp",
    source,
    orgId: profile?.organization_id || organization?.id || "N/A",
    orgName: organization?.name || "N/A",
    userId: user?.id,
    userName: profile?.full_name || user?.user_metadata?.full_name,
    userEmail: user?.email,
    brokerId,
    timestamp: new Date().toISOString(),
    environment: import.meta.env.MODE,
  };
}
