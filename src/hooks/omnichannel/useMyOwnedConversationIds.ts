import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Conjunto de conversation_ids cuja owner ativo é o usuário atual.
 * Fonte de verdade: inbox_assignments (role='owner', unassigned_at IS NULL).
 * Não usar metadata.owner_user_id como fonte de verdade.
 */
export function useMyOwnedConversationIds() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["omnichannel", "my-owned-conversations", user?.id],
    queryFn: async (): Promise<Set<string>> => {
      if (!user?.id) return new Set();
      const { data, error } = await supabase
        .from("inbox_assignments" as any)
        .select("conversation_id")
        .eq("assigned_to", user.id)
        .eq("role", "owner")
        .is("unassigned_at", null);
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.conversation_id));
    },
    enabled: !!user?.id,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}
