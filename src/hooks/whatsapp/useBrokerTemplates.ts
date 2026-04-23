import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BrokerTemplate {
  id: string;
  organization_id: string;
  user_id: string;
  name: string;
  category: string;
  body: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const QK = "broker-message-templates";

export function useBrokerTemplates(category?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [QK, user?.id, category],
    queryFn: async () => {
      let q = supabase
        .from("broker_message_templates" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (category) q = q.eq("category", category);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as BrokerTemplate[];
    },
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; category: string; body: string }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", user!.id)
        .single();

      const { data, error } = await supabase
        .from("broker_message_templates" as any)
        .insert({
          organization_id: profile!.organization_id,
          user_id: user!.id,
          name: input.name,
          category: input.category,
          body: input.body,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as BrokerTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Template criado");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao criar template"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<BrokerTemplate> & { id: string }) => {
      const { error } = await supabase
        .from("broker_message_templates" as any)
        .update(fields as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Template atualizado");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("broker_message_templates" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Template removido");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao remover"),
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
  };
}
