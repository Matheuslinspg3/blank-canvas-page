import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mapa { conversation_id -> last_read_at } do usuário atual.
 * Fonte: conversation_reads. Usado para derivar "não lida" sem
 * unread_count materializado.
 */
export function useConversationReads() {
  const { user, profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["omnichannel", "conversation-reads", orgId, user?.id],
    queryFn: async (): Promise<Map<string, string>> => {
      if (!user?.id || !orgId) return new Map();
      const { data, error } = await supabase
        .from("conversation_reads" as any)
        .select("conversation_id, last_read_at")
        .eq("user_id", user.id)
        .eq("organization_id", orgId);
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((r: any) => map.set(r.conversation_id, r.last_read_at));
      return map;
    },
    enabled: !!user?.id && !!orgId,
    staleTime: 5_000,
  });
}
