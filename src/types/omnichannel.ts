// Domain types for the Omnichannel Hub (Phase 1 — read-only)
// Mirrors the Postgres enums and tables. Kept independent from Database types
// so the UI layer can evolve without touching generated Supabase types.

export type ChannelType =
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "facebook_comments"
  | "sms"
  | "email"
  | "webchat";

export type ConversationStatus =
  | "open"
  | "pending"
  | "assigned"
  | "snoozed"
  | "closed";

export type MessageDirection = "inbound" | "outbound";

export type MessageSenderType = "customer" | "agent" | "ai" | "system";

export type MessageContentType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location"
  | "sticker"
  | "contact"
  | "reaction"
  | "system";

export interface ChannelAccount {
  id: string;
  organization_id: string;
  channel_type: ChannelType;
  external_id: string;
  display_name: string | null;
  status: string;
  metadata: Record<string, unknown>;
  source_table: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  organization_id: string;
  channel_account_id: string;
  channel_type: ChannelType;
  external_contact_id: string;
  customer_display_name: string | null;
  lead_id: string | null;
  status: ConversationStatus;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_preview: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  organization_id: string;
  conversation_id: string;
  channel_account_id: string;
  channel_type: ChannelType;
  direction: MessageDirection;
  sender_type: MessageSenderType | null;
  content_type: MessageContentType;
  content_text: string | null;
  media_url: string | null;
  external_message_id: string | null;
  sent_at: string;
  source_table: string;
  source_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InboxAssignment {
  id: string;
  organization_id: string;
  conversation_id: string;
  assigned_to: string;
  assigned_by: string | null;
  role: "owner" | "collaborator";
  assigned_at: string;
  unassigned_at: string | null;
}
