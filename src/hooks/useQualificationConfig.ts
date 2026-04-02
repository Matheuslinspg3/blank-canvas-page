import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface QualificationConfig {
  id: string;
  organization_id: string;
  required_fields: string[];
  broker_assignment_mode: string;
  auto_qualify_leads: boolean;
  auto_create_leads: boolean;
  schedule_visits: boolean;
  scheduling_days: string[];
  scheduling_hour_start: string;
  scheduling_hour_end: string;
  prompt_qualify_leads: string;
  prompt_create_leads: string;
  prompt_schedule_visits: string;
}

const DEFAULTS: Omit<QualificationConfig, "id" | "organization_id"> = {
  required_fields: ["nome", "telefone", "email"],
  broker_assignment_mode: "manual",
  auto_qualify_leads: false,
  auto_create_leads: false,
  schedule_visits: false,
  scheduling_days: ["seg", "ter", "qua", "qui", "sex"],
  scheduling_hour_start: "09:00",
  scheduling_hour_end: "17:00",
  prompt_qualify_leads: "",
  prompt_create_leads: "",
  prompt_schedule_visits: "",
};

export function useQualificationConfig() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: config, isLoading } = useQuery({
    queryKey: ["qualification-config", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("ai_qualification_config" as any)
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return (data as any) as QualificationConfig | null;
    },
    enabled: !!orgId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<QualificationConfig>) => {
      if (!orgId) throw new Error("Sem organização");

      if (config?.id) {
        const { error } = await supabase
          .from("ai_qualification_config" as any)
          .update({ ...updates, updated_at: new Date().toISOString() } as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("ai_qualification_config" as any)
          .insert({ ...DEFAULTS, ...updates, organization_id: orgId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qualification-config"] });
      toast.success("Configuração salva!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  return {
    config: config ?? ({ ...DEFAULTS } as QualificationConfig),
    isLoading,
    hasConfig: !!config,
    saveConfig: (updates: Partial<QualificationConfig>) => upsertMutation.mutateAsync(updates),
    isSaving: upsertMutation.isPending,
  };
}
