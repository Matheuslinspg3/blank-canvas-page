import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Marca conversa como lida via RPC monotônica.
 * A RPC valida acesso server-side (manager / broker do lead / active assignee)
 * e nunca regride last_read_at (GREATEST no upsert).
 */
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      readAt,
    }: {
      conversationId: string;
      readAt?: string;
    }) => {
      const { error } = await supabase.rpc("mark_conversation_read" as any, {
        p_conversation_id: conversationId,
        ...(readAt ? { p_read_at: readAt } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["omnichannel", "conversation-reads"] });
    },
  });
}
