
# Plano: Melhorar Agente IA WhatsApp - Prompt Dinâmico e Agendamento

## Conceito Principal

Cada toggle de funcionalidade (auto-qualificacao, criar lead, agendamento) gera automaticamente um trecho de prompt que e composto no `system_prompt` final enviado ao N8N. O usuario tambem configura dias e horarios disponiveis para agendamento de visitas.

## 1. Migração de Banco de Dados

Adicionar colunas na tabela `whatsapp_agent_config`:

```sql
ALTER TABLE whatsapp_agent_config
  ADD COLUMN IF NOT EXISTS scheduling_days text[] NOT NULL DEFAULT '{seg,ter,qua,qui,sex}',
  ADD COLUMN IF NOT EXISTS scheduling_hour_start text NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS scheduling_hour_end text NOT NULL DEFAULT '17:00';
```

- `scheduling_days` -- dias da semana disponiveis (seg, ter, qua, qui, sex, sab, dom)
- `scheduling_hour_start` / `scheduling_hour_end` -- janela de horario para visitas

## 2. Atualizar AgentConfig Interface e Hook

Adicionar os 3 novos campos ao tipo `AgentConfig` e aos DEFAULTS no hook `useWhatsAppAgentConfig.ts`.

## 3. Refatorar AgentBehaviorTab -- Prompt Composto

- O campo "Prompt de Sistema" continua editavel pelo usuario (instrucao base).
- Abaixo do textarea, exibir um bloco **read-only** "Preview do Prompt Final" que mostra em tempo real o prompt completo que sera enviado a IA.
- O prompt final e composto assim:

```text
[system_prompt do usuario]

--- Regras Ativas ---
[se auto_qualify_leads ON]:
"Ao iniciar uma conversa, colete nome completo, telefone, e-mail e interesse do cliente de forma natural."

[se auto_create_leads ON]:
"Apos coletar os dados do cliente, registre automaticamente como lead no CRM."

[se schedule_visits ON]:
"Voce pode agendar visitas. Horarios disponiveis: [dias] das [hora_inicio] as [hora_fim]. Confirme data e horario com o cliente antes de registrar."

[se is_property_db_enabled ON]:
"Voce tem acesso ao banco de imoveis da imobiliaria. Use-o para recomendar imoveis relevantes."
```

- Este preview e apenas visual; o prompt composto e montado no backend (Edge Function).

## 4. Refatorar AgentQualificationTab -- Agendamento Detalhado

Na secao de Agendamento (quando `schedule_visits` esta ON), expandir para mostrar:
- **Dias disponiveis**: checkboxes para cada dia da semana (Seg a Dom)
- **Horario de visitas**: inputs de hora inicio e fim
- Esses campos so aparecem quando o toggle de agendamento esta ativo

## 5. Atualizar Edge Function `whatsapp-webhook-config`

No endpoint que retorna config para o N8N, montar o `composed_system_prompt` dinamicamente:
- Pegar o `system_prompt` base
- Concatenar trechos baseados nos toggles ativos
- Incluir dados de agendamento no trecho de schedule_visits
- Retornar o campo `composed_system_prompt` no response junto com `agent_config`

Assim o N8N usa diretamente o `composed_system_prompt` como system message, sem precisar montar logica de prompt la.

## 6. Arquivos Impactados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/migrations/...` | Nova migracao com colunas scheduling |
| `src/hooks/useWhatsAppAgentConfig.ts` | Novos campos no tipo e defaults |
| `src/integrations/supabase/types.ts` | Atualizado automaticamente |
| `src/components/.../AgentBehaviorTab.tsx` | Preview do prompt composto |
| `src/components/.../AgentQualificationTab.tsx` | UI de dias/horarios de agendamento |
| `supabase/functions/whatsapp-webhook-config/index.ts` | Montar composed_system_prompt |
