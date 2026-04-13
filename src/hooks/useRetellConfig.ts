import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface RetellAgentConfig {
  id: string;
  organization_id: string;
  agent_id: string;
  agent_name: string;
  qualification_prompt: string;
  transfer_keywords: string[];
  max_call_duration_min: number;
  working_hours_start: string;
  working_hours_end: string;
  auto_qualify_leads: boolean;
  auto_create_leads: boolean;
  enabled: boolean;
  notification_template_broker: string;
  notification_template_client: string;
  broker_assignment_mode: string;
  score_criteria: Record<string, number>;
  n8n_webhook_url: string;
  post_call_analysis_prompt: string;
  updated_at: string;
}

const DEFAULTS: Partial<RetellAgentConfig> = {
  agent_id: "",
  agent_name: "Agente de Voz",
  qualification_prompt: "",
  transfer_keywords: ["falar com corretor", "atendente", "humano"],
  max_call_duration_min: 15,
  working_hours_start: "08:00",
  working_hours_end: "18:00",
  auto_qualify_leads: false,
  auto_create_leads: false,
  enabled: false,
  notification_template_broker: "Novo lead qualificado via chamada de voz!\n\nNome: {{lead_name}}\nTelefone: {{lead_phone}}\nScore: {{score}}/100\nResumo: {{summary}}",
  notification_template_client: "Obrigado pela sua ligação! Um corretor especializado entrará em contato em breve.",
  broker_assignment_mode: "round_robin",
  score_criteria: {
    interesse_compra: 30,
    orcamento_definido: 25,
    prazo_definido: 20,
    regiao_definida: 15,
    documentacao_pronta: 10,
  },
  n8n_webhook_url: "",
  post_call_analysis_prompt: "Analise a transcrição da chamada e extraia: nome do cliente, telefone, orçamento, região de interesse, tipo de imóvel, prazo para compra e nível de interesse (1-10). Retorne em JSON.",
};

export function useRetellConfig() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: config, isLoading } = useQuery({
    queryKey: ["retell-agent-config", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("retell_agent_config" as any)
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return (data as any) as RetellAgentConfig | null;
    },
    enabled: !!orgId,
  });

  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<RetellAgentConfig>) => {
      if (!orgId) throw new Error("Sem organização");
      if (config?.id) {
        const { error } = await supabase
          .from("retell_agent_config" as any)
          .update(updates as any)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("retell_agent_config" as any)
          .insert({ ...DEFAULTS, ...updates, organization_id: orgId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retell-agent-config"] });
      toast.success("Configuração salva!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  return {
    config: config ?? (DEFAULTS as RetellAgentConfig),
    isLoading,
    hasConfig: !!config,
    saveConfig: (updates: Partial<RetellAgentConfig>) => upsertMutation.mutateAsync(updates),
    isSaving: upsertMutation.isPending,
  };
}
