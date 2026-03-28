
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
  updated_at: string;
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
};

export function useWhatsAppAgentConfig() {
  const { profile } = useAuth();
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
