import { supabase } from "@/integrations/supabase/client";
import type { Message } from "@/types/omnichannel";

export interface ListMessagesParams {
  conversationId: string;
  limit?: number;
  before?: string; // ISO timestamp for pagination
}

export async function listMessagesByConversation(
  params: ListMessagesParams
): Promise<Message[]> {
  const { conversationId, limit = 100, before } = params;
  let q = supabase
    .from("messages" as any)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (before) q = q.lt("sent_at", before);

  const { data, error } = await q;
  if (error) throw error;
  // Return chronological for UI consumption
  return ((data as any) as Message[]).reverse();
}
