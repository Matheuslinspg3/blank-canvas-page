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
  retell_phone_number_id: string;
  retell_from_number: string;
  auto_outbound_enabled: boolean;
  max_call_attempts: number;
  min_minutes_between_attempts: number;
  updated_at: string;
}

const DEFAULTS: Partial<RetellAgentConfig> = {
  agent_id: "",
  agent_name: "Sofia — Assistente Porto Caiçara",
  qualification_prompt: `Você é Sofia, assistente virtual da Porto Caiçara Imóveis, uma imobiliária referência no litoral.

PERSONALIDADE:
- Tom acolhedor, profissional e consultivo — como uma corretora experiente e empática.
- Use linguagem acessível, evite jargões técnicos a menos que o cliente demonstre conhecimento.
- Sempre trate o cliente pelo nome assim que souber.

OBJETIVO DA CHAMADA:
Qualificar o interesse do cliente de forma natural e consultiva, coletando informações estratégicas sem parecer um interrogatório.

INFORMAÇÕES A COLETAR (em ordem de prioridade):
1. Nome completo
2. Tipo de interesse: compra, locação ou investimento
3. Tipo de imóvel desejado: apartamento, casa, terreno, sala comercial, cobertura
4. Região/bairro de preferência (ex: Praia Grande, Caiçara, Aviação, Boqueirão, Guilhermina)
5. Faixa de orçamento ou valor de parcela aceitável
6. Quantidade de quartos/suítes desejada
7. Prazo: urgente (até 30 dias), curto (1-3 meses), médio (3-6 meses), longo (6+ meses)
8. Finalidade: moradia própria, segunda residência, investimento, temporada
9. Se já possui financiamento pré-aprovado ou FGTS disponível
10. Contato preferido: WhatsApp, telefone ou e-mail

REGRAS DE CONDUTA:
- NUNCA invente informações sobre imóveis, preços ou disponibilidade.
- Se não souber responder, diga: "Vou verificar com nosso time e retornar rapidamente."
- Se o cliente pedir para falar com um corretor, transfira imediatamente sem insistir.
- Mencione diferenciais da Porto Caiçara: atendimento personalizado, conhecimento do litoral, acompanhamento completo do processo.
- Ao final, confirme os dados coletados e informe que um corretor especializado entrará em contato.`,
  transfer_keywords: ["falar com corretor", "atendente", "humano", "pessoa real", "corretor"],
  max_call_duration_min: 15,
  working_hours_start: "08:00",
  working_hours_end: "18:00",
  auto_qualify_leads: true,
  auto_create_leads: true,
  enabled: false,
  notification_template_broker: `🏠 Novo lead qualificado via chamada de voz — Porto Caiçara

👤 Nome: {{lead_name}}
📞 Telefone: {{lead_phone}}
⭐ Score: {{score}}/100
📍 Região: {{region}}
🏡 Tipo: {{property_type}}

📋 Resumo:
{{summary}}

⏰ Ação recomendada: Entrar em contato em até 30 minutos.`,
  notification_template_client: "Obrigado por ligar para a Porto Caiçara Imóveis! 🏠\n\nRecebemos suas informações e um corretor especializado na região do seu interesse entrará em contato em breve.\n\nEnquanto isso, confira nossos imóveis em portocaicaraimoveis.lovable.app",
  broker_assignment_mode: "round_robin",
  score_criteria: {
    interesse_compra: 25,
    orcamento_definido: 25,
    prazo_definido: 20,
    regiao_definida: 15,
    documentacao_pronta: 15,
  },
  n8n_webhook_url: "",
  retell_phone_number_id: "",
  retell_from_number: "",
  auto_outbound_enabled: false,
  max_call_attempts: 3,
  min_minutes_between_attempts: 30,
  post_call_analysis_prompt: `Analise a transcrição da chamada da Porto Caiçara Imóveis e extraia os seguintes dados em JSON:

{
  "nome_completo": "string",
  "telefone": "string",
  "email": "string | null",
  "tipo_interesse": "compra | locacao | investimento",
  "tipo_imovel": "apartamento | casa | terreno | sala_comercial | cobertura | outro",
  "regiao_preferencia": ["string"],
  "faixa_orcamento_min": number | null,
  "faixa_orcamento_max": number | null,
  "quartos_desejados": number | null,
  "prazo": "urgente | curto | medio | longo",
  "finalidade": "moradia | segunda_residencia | investimento | temporada",
  "possui_financiamento": boolean | null,
  "possui_fgts": boolean | null,
  "nivel_interesse": number (1-10),
  "temperatura": "quente | morno | frio",
  "resumo_conversa": "string (máx 200 palavras)",
  "proximos_passos": "string",
  "objecoes_identificadas": ["string"],
  "imoveis_mencionados": ["string"]
}

REGRAS:
- Se uma informação não foi mencionada, use null.
- A temperatura deve ser baseada no engajamento: quente (muito interessado, pronto para visitar), morno (interessado mas sem urgência), frio (apenas pesquisando).
- Em "proximos_passos", sugira a melhor ação para o corretor (agendar visita, enviar catálogo, ligar novamente, etc).
- Em "objecoes_identificadas", liste preocupações do cliente (preço alto, localização, documentação, etc).`,
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
