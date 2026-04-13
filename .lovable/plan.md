

# Plano: Integração Retell AI (Modelo Híbrido)

## Conceito

O agente base (voz, LLM, prompt principal) fica configurado no painel da Retell AI. Admins do Portal ajustam parâmetros operacionais pela interface, similar ao padrão já usado no `whatsapp_agent_config`.

## Pré-requisito: Secrets

Não existem `RETELL_API_KEY` nem `RETELL_AGENT_ID` nos secrets. Precisarei adicioná-los antes de qualquer implementação.

## 1. Tabela `retell_agent_config`

Configurações editáveis pelo admin no Portal (uma por organização):

| Campo | Tipo | Descrição |
|---|---|---|
| organization_id | UUID FK | Organização |
| agent_id | TEXT | Agent ID da Retell (pré-preenchido) |
| agent_name | TEXT | Nome exibido no Portal |
| qualification_prompt | TEXT | Prompt extra de qualificação |
| transfer_keywords | TEXT[] | Palavras para transferir ao corretor |
| max_call_duration_min | INT | Duração máxima da chamada |
| working_hours_start/end | TEXT | Horário de operação |
| auto_qualify_leads | BOOLEAN | Qualificar leads automaticamente |
| auto_create_leads | BOOLEAN | Criar leads no CRM |

RLS por `organization_id`, mesmo padrão do `whatsapp_agent_config`.

## 2. Tabela `voice_calls`

Histórico de chamadas (conforme plano anterior).

## 3. Edge Functions

- **`retell-create-web-call`**: Gera access_token para chamada WebRTC, compondo prompt base + configurações do admin
- **`retell-webhook`**: Recebe eventos `call_ended`/`call_analyzed`, salva em `voice_calls`

## 4. Componentes React

```text
src/components/automations/retell/
├── RetellVoicePanel.tsx      # Painel principal com sub-tabs
├── RetellConfigTab.tsx       # Configurações editáveis (prompt, horários, keywords)
├── RetellCallWidget.tsx      # Widget de chamada web (botão + status WebRTC)
└── RetellCallHistory.tsx     # Histórico de chamadas com transcrição
```

**RetellConfigTab**: Formulário com os campos da tabela `retell_agent_config`, protegido por `canConfigureAgent` (admin/subadmin/dev). Segue o padrão visual do `AgentBehaviorTab`.

**RetellCallWidget**: Botão "Iniciar Chamada" → chama Edge Function → SDK `retell-client-js-sdk` → estados visuais (idle/connecting/speaking).

## 5. Nova aba em Automations.tsx

Tab "Voz (Retell)" com ícone `Phone`, protegida por `FeatureFlagGate`.

## Sequência

1. Solicitar secrets `RETELL_API_KEY` e `RETELL_AGENT_ID`
2. Criar migrações (`retell_agent_config` + `voice_calls`)
3. Criar Edge Functions
4. Criar componentes React
5. Adicionar aba em Automations

