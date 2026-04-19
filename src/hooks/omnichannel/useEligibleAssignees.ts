import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface EligibleAssignee {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const ELIGIBLE_ROLES = ["corretor", "assistente", "leader", "sub_admin", "admin", "developer"];

/**
 * Lista membros da org elegíveis para serem owner de conversa
 * (qualquer um com pelo menos um dos papéis operacionais).
 */
export function useEligibleAssignees() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["omnichannel", "eligible-assignees", orgId],
    queryFn: async (): Promise<EligibleAssignee[]> => {
      if (!orgId) return [];
      // Buscar perfis da org + filtrar por roles elegíveis via user_roles
      const { data: rolesRows, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ELIGIBLE_ROLES as any);
      if (rolesErr) throw rolesErr;
      const eligibleIds = Array.from(new Set((rolesRows ?? []).map((r: any) => r.user_id)));
      if (eligibleIds.length === 0) return [];

      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url, organization_id")
        .eq("organization_id", orgId)
        .in("user_id", eligibleIds);
      if (pErr) throw pErr;

      return (profs ?? []).map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
      }));
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
