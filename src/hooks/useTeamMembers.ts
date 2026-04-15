import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";

export interface TeamMember {
  user_id: string;
  full_name: string;
  email: string | null;
  last_sign_in_at: string | null;
  joined_at: string;
  roles: string[];
  custom_role_id: string | null;
  total_actions_30d: number;
  active_leads: number;
  total_contracts: number;
  total_properties: number;
  actions_by_type: Record<string, number>;
}

export function useTeamMembers() {
  const { profile } = useAuth();

  const query = useQuery({
    queryKey: ["team-members-stats", profile?.organization_id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-member`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "get_member_stats" }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch members");
      }
      return (await res.json()) as TeamMember[];
    },
    enabled: !!profile?.organization_id,
    staleTime: 2 * 60 * 1000,
  });

  return query;
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-member`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "remove_member", user_id: userId, reason }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to remove member");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["team-members-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-team"] });
      queryClient.invalidateQueries({ queryKey: ["org-brokers"] });
      toast.success(`${data.name || "Membro"} removido da equipe`);
    },
    onError: (err: Error) => {
      toastError("Erro ao remover membro", err, { module: "useTeamMembers" });
    },
  });
}

/**
 * Phase 1: Centralized role change via manage-member endpoint.
 * Replaces direct writes to user_roles table.
 */
export function useChangeRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newRole, reason }: { userId: string; newRole: string; reason?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-member`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "change_role", user_id: userId, new_role: newRole, reason }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to change role");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["team-members-stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin-team"] });
      queryClient.invalidateQueries({ queryKey: ["all-user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
      toast.success(`Cargo de ${data.name || "membro"} alterado para ${data.new_role}`);
    },
    onError: (err: Error) => {
      toastError("Erro ao alterar cargo", err, { module: "useTeamMembers" });
    },
  });
}
