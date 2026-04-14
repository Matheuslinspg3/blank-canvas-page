import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ScoreCriterion {
  key: string;
  label: string;
  weight: number;
  enabled: boolean;
}

export interface TemperatureThresholds {
  cold_max: number;
  warm_max: number;
}

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
  auto_scoring: boolean;
  score_criteria: ScoreCriterion[];
  temperature_thresholds: TemperatureThresholds;
  default_lead_stage_id: string | null;
}

export const DEFAULT_SCORE_CRITERIA: ScoreCriterion[] = [
  { key: "responded_24h", label: "Respondeu em menos de 24h", weight: 10, enabled: true },
  { key: "informed_budget", label: "Informou orçamento/renda", weight: 20, enabled: true },
  { key: "informed_region", label: "Informou região de interesse", weight: 15, enabled: true },
  { key: "financing_simulation", label: "Pediu simulação de financiamento", weight: 20, enabled: true },
  { key: "scheduled_visit", label: "Agendou visita", weight: 25, enabled: true },
  { key: "paid_campaign", label: "Origem: campanha paga", weight: 10, enabled: true },
];

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
  auto_scoring: false,
  score_criteria: DEFAULT_SCORE_CRITERIA,
  temperature_thresholds: { cold_max: 30, warm_max: 69 },
  default_lead_stage_id: null,
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
