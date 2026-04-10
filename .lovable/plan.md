

# Plano: Implementar 8 Funcionalidades Avançadas de Boas-Vindas

## Resumo

Adicionar ao sistema de boas-vindas existente: mensagens por horario, media anexa, preview/teste, metricas de engajamento, A/B testing automatico, conteudo condicional (lead vs desconhecido), delay inteligente, e suporte a origem/campanha.

## 1. Migracoes de Banco de Dados

### Tabela `whatsapp_welcome_messages` - novas colunas:
```sql
ALTER TABLE whatsapp_welcome_messages
  ADD COLUMN time_period text DEFAULT 'all',        -- 'all', 'morning', 'afternoon', 'night'
  ADD COLUMN media_url text,                         -- URL de imagem/video/audio
  ADD COLUMN media_type text,                        -- 'image', 'video', 'audio', null
  ADD COLUMN target_audience text DEFAULT 'all',     -- 'all', 'new_only', 'leads_only'
  ADD COLUMN campaign_tag text,                      -- tag de campanha/origem
  ADD COLUMN reply_count integer DEFAULT 0,          -- quantas vezes foi respondida
  ADD COLUMN reply_rate numeric(5,2) DEFAULT 0;      -- taxa de resposta calculada
```

### Tabela `whatsapp_agent_config` - novas colunas:
```sql
ALTER TABLE whatsapp_agent_config
  ADD COLUMN welcome_delay_min integer DEFAULT 3,    -- delay minimo em segundos
  ADD COLUMN welcome_delay_max integer DEFAULT 8,    -- delay maximo em segundos
  ADD COLUMN welcome_ab_test boolean DEFAULT false;  -- A/B testing ativo
```

### Tabela `whatsapp_welcome_log` - nova coluna:
```sql
ALTER TABLE whatsapp_welcome_log
  ADD COLUMN replied boolean DEFAULT false;          -- se respondeu esta msg especifica
```

### Trigger para calcular reply_rate:
Trigger na `whatsapp_welcome_log` que, ao marcar `replied = true`, atualiza `reply_count` e `reply_rate` na mensagem correspondente.

## 2. Edge Function `whatsapp-get-welcome` - Atualizacoes

- **Horario**: Determinar periodo (manha 6-12, tarde 12-18, noite 18-6) e filtrar mensagens com `time_period` correspondente ou `'all'`
- **Conteudo condicional**: Receber parametro `is_lead` do n8n; filtrar por `target_audience`
- **Campanha**: Receber parametro opcional `campaign_tag`; priorizar mensagens com tag correspondente
- **A/B Testing**: Se `welcome_ab_test` ativo, selecionar aleatoriamente em vez de round-robin, ponderando por `reply_rate` (exploitation) com 20% exploracao
- **Media**: Retornar `media_url` e `media_type` no response para o n8n enviar como midia
- **Delay**: Retornar `delay_seconds` (random entre min e max) no response para o n8n aplicar um Wait

## 3. UI - `AgentWelcomeTab.tsx` Melhorias

- **Periodo do dia**: Select dropdown por mensagem (Todos / Manha / Tarde / Noite)
- **Media**: Botao de upload/URL para anexar imagem ao lado do textarea
- **Audiencia**: Select (Todos / Novos / Leads existentes)
- **Campaign tag**: Input de texto opcional
- **Metricas**: Exibir `reply_rate%` e `reply_count` ao lado de `usage_count`
- **Preview/Teste**: Botao "Testar" que chama a edge function com dados mockados e mostra o resultado em um modal simulando WhatsApp (bolha verde)

## 4. Configuracoes Globais (no painel existente)

- **Delay**: Dois inputs numericos (min/max segundos) no `AgentWelcomeTab` ou na config geral
- **A/B Testing**: Toggle on/off que ativa selecao inteligente baseada em performance

## 5. Trigger de Reply Tracking

Atualizar o trigger existente em `whatsapp_welcome_log` para:
- Marcar `replied = true` quando o contato responde
- Incrementar `reply_count` na `whatsapp_welcome_messages`
- Recalcular `reply_rate = (reply_count / usage_count) * 100`

## Impacto no n8n

O node BOAS-VINDAS existente recebera campos extras no response:
- `media_url`, `media_type` -> Se presente, enviar como midia via Evolution API
- `delay_seconds` -> Aplicar Wait node antes de enviar
- Enviar `is_lead: true/false` no body (verificar se o contato existe na tabela leads)

## Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| Migration SQL | Novas colunas em 3 tabelas + trigger |
| `whatsapp-get-welcome/index.ts` | Logica de horario, A/B, campanha, audiencia, media, delay |
| `AgentWelcomeTab.tsx` | UI para periodo, media, audiencia, tag, metricas, preview |
| `useWhatsAppAgentConfig.ts` | Novos campos delay e ab_test |
| `types.ts` | Auto-atualizado pela migracao |

