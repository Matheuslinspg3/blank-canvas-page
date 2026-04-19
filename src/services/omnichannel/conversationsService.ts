import { supabase } from "@/integrations/supabase/client";
import type {
  Conversation,
  ConversationStatus,
  ChannelType,
} from "@/types/omnichannel";

export interface ListConversationsParams {
  organizationId?: string;
  channelType?: ChannelType;
  status?: ConversationStatus;
  channelAccountId?: string;
  leadId?: string;
  limit?: number;
  offset?: number;
}

export async function listConversations(
  params: ListConversationsParams = {}
): Promise<Conversation[]> {
  const { limit = 50, offset = 0 } = params;
  let q = supabase
    .from("conversations" as any)
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (params.organizationId) q = q.eq("organization_id", params.organizationId);
  if (params.channelType) q = q.eq("channel_type", params.channelType);
  if (params.status) q = q.eq("status", params.status);
  if (params.channelAccountId) q = q.eq("channel_account_id", params.channelAccountId);
  if (params.leadId) q = q.eq("lead_id", params.leadId);

  const { data, error } = await q;
  if (error) throw error;
  return (data as any) as Conversation[];
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations" as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as any) as Conversation | null;
}

export async function updateConversationStatus(
  id: string,
  status: ConversationStatus
): Promise<void> {
  const { error } = await supabase
    .from("conversations" as any)
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}
