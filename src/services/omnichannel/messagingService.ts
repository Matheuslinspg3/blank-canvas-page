import { supabase } from "@/integrations/supabase/client";
import type { Conversation } from "@/types/omnichannel";

export interface SendPayload {
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "document" | "audio";
}

/**
 * Extrai o telefone (somente dígitos) a partir do identificador externo do
 * WhatsApp. Aceita "5511999999999", "5511...@s.whatsapp.net", "...@c.us", com
 * caracteres não-numéricos. Validação mínima: ao menos 10 dígitos.
 */
function extractWhatsappPhone(externalContactId: string): string {
  const local = (externalContactId ?? "").split("@")[0] ?? "";
  const digits = local.replace(/\D/g, "");
  if (digits.length < 10) throw new Error("invalid_whatsapp_contact_id");
  return digits;
}

async function sendViaWhatsApp(conv: Conversation, payload: SendPayload) {
  const phone = extractWhatsappPhone(conv.external_contact_id);

  // Check if conversation belongs to a broker channel (channel_subtype or metadata)
  const isBrokerChannel = await checkIsBrokerChannel(conv.channel_account_id);

  if (isBrokerChannel) {
    return sendViaBrokerWhatsApp(conv, phone, payload);
  }

  // Adapter envia apenas referência estável (channelAccountId). A edge
  // `whatsapp-send` resolve server-side a instância real, valida org/canal/
  // status. Cliente nunca é fonte de verdade do nome da instância.
  const body: Record<string, unknown> = {
    channelAccountId: conv.channel_account_id,
    phone,
    message: payload.text,
    type: payload.mediaUrl ? "media" : "text",
  };
  if (payload.mediaUrl) {
    body.mediaUrl = payload.mediaUrl;
    body.mediaType = payload.mediaType ?? "image";
  }

  const { data, error } = await supabase.functions.invoke("whatsapp-send", { body });
  if (error) throw error;
  return data;
}

/**
 * Check if a channel_account belongs to a broker WhatsApp channel.
 */
async function checkIsBrokerChannel(channelAccountId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("channel_accounts")
      .select("source_table, metadata")
      .eq("id", channelAccountId)
      .maybeSingle();
    if (data?.source_table === "broker_whatsapp_channels") return true;
    if ((data?.metadata as any)?.channel_subtype === "broker") return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Send via broker's individual WhatsApp channel (whatsapp-broker-send).
 */
async function sendViaBrokerWhatsApp(conv: Conversation, phone: string, payload: SendPayload) {
  const body: Record<string, unknown> = {
    channelAccountId: conv.channel_account_id,
    phone,
    message: payload.text,
    type: payload.mediaUrl ? "media" : "text",
  };
  if (payload.mediaUrl) {
    body.mediaUrl = payload.mediaUrl;
    body.mediaType = payload.mediaType ?? "image";
  }

  const { data, error } = await supabase.functions.invoke("whatsapp-broker-send", { body });
  if (error) throw error;
  return data;
}

/**
 * Phase 3B: outbound Meta (Instagram Direct + Facebook Messenger).
 * Edge `meta-messaging-send` resolve credenciais server-side e valida feature flag.
 * O cliente envia apenas referências estáveis (channelAccountId, recipientId).
 */
async function sendViaMeta(conv: Conversation, payload: SendPayload) {
  const body: Record<string, unknown> = {
    channelAccountId: conv.channel_account_id,
    recipientId: conv.external_contact_id,
    message: payload.text,
    type: payload.mediaUrl ? "media" : "text",
  };
  if (payload.mediaUrl) {
    body.mediaUrl = payload.mediaUrl;
    body.mediaType = payload.mediaType ?? "image";
  }
  const { data, error } = await supabase.functions.invoke("meta-messaging-send", { body });
  if (error) throw error;
  return data;
}

/**
 * Adapter público de envio. UI nunca toca canal específico.
 * Cada novo canal adiciona um `sendVia<Canal>` privado e um case no switch.
 */
export async function sendConversationMessage(
  conv: Conversation,
  payload: SendPayload,
) {
  switch (conv.channel_type) {
    case "whatsapp":
      return sendViaWhatsApp(conv, payload);
    case "instagram":
    case "messenger":
      return sendViaMeta(conv, payload);
    case "facebook_comments":
    case "sms":
    case "email":
    case "webchat":
      throw new Error(`channel_not_supported_in_phase_2:${conv.channel_type}`);
    default:
      throw new Error("unknown_channel");
  }
}
