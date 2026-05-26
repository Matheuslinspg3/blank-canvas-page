import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface AgentConfig {
  id: string;
  organization_id: string;
  agent_name: string;
  tone: "formal" | "informal" | "tecnico";
  system_prompt: string;
  is_property_db_enabled: boolean;
  auto_qualify_leads: boolean;
  auto_create_leads: boolean;
  schedule_visits: boolean;
  working_hours_start: string;
  working_hours_end: string;
  welcome_message: string;
  away_message: string;
  transfer_keywords: string[];
  max_messages_before_transfer: number;
  broker_assignment_mode: string;
  scheduling_days: string[];
  scheduling_hour_start: string;
  scheduling_hour_end: string;
  prompt_qualify_leads: string | null;
  prompt_create_leads: string | null;
  prompt_schedule_visits: string | null;
  prompt_property_db: string | null;
  instance_name: string | null;
  instance_token: string | null;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  webhook_url: string | null;
  transfer_phone: string | null;
  transfer_message: string | null;
  voice_enabled: boolean;
  voice_percentage: number;
  voice_id: string;
  updated_at: string;
  welcome_delay_min: number;
  welcome_delay_max: number;
  welcome_ab_test: boolean;
  crm_new_lead_stage_id: string | null;
  crm_qualified_stage_id: string | null;
  crm_auto_advance_on_qualified: boolean;
}

const DEFAULTS: Partial<AgentConfig> = {
  agent_name: "Valentina",
  tone: "informal",
  system_prompt: "",
  is_property_db_enabled: false,
  auto_qualify_leads: false,
  auto_create_leads: false,
  schedule_visits: false,
  working_hours_start: "08:00",
  working_hours_end: "18:00",
  welcome_message: "Olá! Sou a Valentina, assistente virtual. Como posso ajudar?",
  away_message: "No momento estamos fora do horário de atendimento. Retornaremos em breve!",
  transfer_keywords: ["falar com corretor", "atendente", "humano", "reclamação"],
  max_messages_before_transfer: 10,
  broker_assignment_mode: "manual",
  scheduling_days: ["seg", "ter", "qua", "qui", "sex"],
  scheduling_hour_start: "09:00",
  scheduling_hour_end: "17:00",
  prompt_qualify_leads: "",
  prompt_create_leads: "",
  prompt_schedule_visits: "",
  prompt_property_db: "",
  status: "disconnected",
  voice_enabled: false,
  voice_percentage: 0,
  voice_id: "EXAVITQu4vr4xnSDxMaL",
  welcome_delay_min: 3,
  welcome_delay_max: 8,
  welcome_ab_test: false,
};

export function useWhatsAppAgentConfig() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: config, isLoading } = useQuery({
    queryKey: ["whatsapp-agent-config", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("whatsapp_agent_config" as any)
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return (data as any) as AgentConfig | null;
    },
    enabled: !!orgId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<AgentConfig>) => {
      if (!orgId) throw new Error("Sem organização");

      if (config?.id) {
        const { error } = await supabase
          .from("whatsapp_agent_config" as any)
          .update(updates as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_agent_config" as any)
          .insert({ ...DEFAULTS, ...updates, organization_id: orgId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-agent-config"] });
      toast.success("Configuração salva!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  return {
    config: config ?? (DEFAULTS as AgentConfig),
    isLoading,
    hasConfig: !!config,
    saveConfig: (updates: Partial<AgentConfig>) => upsertMutation.mutateAsync(updates),
    isSaving: upsertMutation.isPending,
  };
}
