import { supabase } from "@/integrations/supabase/client";

/**
 * Atribui (ou re-atribui) o owner de uma conversa via RPC atômica.
 * A RPC valida server-side: papel do ator, mesma org, papel elegível do
 * assignee, e usa lock pessimista para serializar concorrência.
 */
export async function assignConversationOwner(
  conversationId: string,
  assigneeId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("assign_conversation_owner" as any, {
    p_conversation_id: conversationId,
    p_assignee_id: assigneeId,
  });
  if (error) throw error;
  return data as string;
}

export interface ActiveAssignment {
  id: string;
  conversation_id: string;
  assigned_to: string;
  assigned_by: string | null;
  role: string;
  assigned_at: string;
}

export async function getActiveOwner(
  conversationId: string,
): Promise<ActiveAssignment | null> {
  const { data, error } = await supabase
    .from("inbox_assignments" as any)
    .select("id, conversation_id, assigned_to, assigned_by, role, assigned_at")
    .eq("conversation_id", conversationId)
    .eq("role", "owner")
    .is("unassigned_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as any) as ActiveAssignment | null;
}
