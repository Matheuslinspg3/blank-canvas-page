

# Painel de Configuração do Agente IA (WhatsApp) — Valentina

## Visão Geral

Transformar a aba "Agente IA (WhatsApp)" de um simples card de conexão WhatsApp em um painel completo de configuração do agente, com múltiplas seções para controlar o comportamento da Valentina e sua integração com o banco de imóveis.

## Funcionalidades Propostas

### 1. Conexão WhatsApp (já existe)
Manter o card atual de ativação/QR Code/status.

### 2. Banco de Imóveis do Agente
- **Toggle global**: Habilitar/desabilitar acesso da IA ao banco de imóveis
- **Modo de acesso**: A IA consulta diretamente a tabela `properties` do Supabase via uma Edge Function dedicada, filtrada por `organization_id`
- **Whitelist de imóveis**: Seletor para marcar imóveis específicos que a IA PODE apresentar
- **Blacklist de imóveis**: Seletor para marcar imóveis que a IA NÃO DEVE mencionar (ex: vendidos, reservados)
- **Imóveis em destaque**: Marcar imóveis em anúncio/promoção para a IA priorizar nas recomendações
- **Filtros automáticos**: Configurar regras como "só mostrar imóveis com status ativo" ou "excluir imóveis acima de X valor"

### 3. Personalidade e Comportamento
- **Nome do agente**: Editável (padrão: Valentina)
- **Tom de voz**: Formal / Informal / Técnico
- **Prompt de sistema**: Campo de texto para instrução base da IA
- **Horário de atendimento**: Definir quando o agente responde automaticamente vs. mensagem de ausência
- **Mensagem de boas-vindas**: Template da primeira mensagem
- **Mensagem de ausência**: Template fora do horário

### 4. Qualificação de Leads
- **Auto-qualificação**: Toggle para a IA perguntar automaticamente nome, e-mail, telefone, interesse
- **Criação automática de lead**: Toggle para criar lead no CRM ao capturar dados
- **Atribuição de corretor**: Regra de distribuição (round-robin, por região, manual)
- **Agendamento de visitas**: Toggle para permitir que a IA agende visitas diretamente na agenda

### 5. Transferência para Humano
- **Gatilhos de transferência**: Lista de palavras-chave ou situações que disparam transferência (ex: "falar com corretor", reclamação, financiamento)
- **Notificação**: Push/WhatsApp para o corretor quando transferido
- **Fallback**: Após X mensagens sem resolução, transferir automaticamente

### 6. Histórico e Analytics
- **Log de conversas**: Visualizar conversas recentes do agente
- **Métricas**: Total de atendimentos, leads qualificados, taxa de transferência, tempo médio de resposta
- **Feedback**: Rating das conversas

## Arquitetura Técnica

### Banco de Dados (novas tabelas)

```text
whatsapp_agent_config
├── id (uuid PK)
├── organization_id (FK → organizations)
├── agent_name (text, default "Valentina")
├── tone (enum: formal | informal | tecnico)
├── system_prompt (text)
├── is_property_db_enabled (bool)
├── auto_qualify_leads (bool)
├── auto_create_leads (bool)
├── schedule_visits (bool)
├── working_hours_start (time)
├── working_hours_end (time)
├── welcome_message (text)
├── away_message (text)
├── transfer_keywords (text[])
├── max_messages_before_transfer (int)
└── updated_at (timestamptz)

whatsapp_property_rules
├── id (uuid PK)
├── organization_id (FK → organizations)
├── property_id (FK → properties)
├── rule_type (enum: whitelist | blacklist | highlight)
├── created_at (timestamptz)
└── UNIQUE(organization_id, property_id, rule_type)
```

### Fluxo N8N — Banco de Imóveis

```text
[WhatsApp msg] → [N8N Workflow]
                      │
                      ├─ Detecta intenção (busca de imóvel)
                      │
                      ├─ Chama Edge Function "whatsapp-agent-properties"
                      │   ├─ Lê whatsapp_agent_config (DB habilitado?)
                      │   ├─ Lê whatsapp_property_rules (white/black/highlight)
                      │   ├─ Consulta properties filtrada
                      │   └─ Retorna JSON com imóveis permitidos
                      │
                      ├─ IA monta resposta com imóveis
                      └─ Envia via WhatsApp
```

A Edge Function `whatsapp-agent-properties` recebe `organization_id` + filtros do cliente (quartos, bairro, valor) e retorna apenas imóveis que:
1. Estão na whitelist OU não têm regra (se whitelist vazia = todos)
2. NÃO estão na blacklist
3. Imóveis com `highlight` vêm primeiro no ranking

### Fluxo N8N — Configuração

O N8N chama uma Edge Function `whatsapp-agent-config` para buscar a configuração atual (prompt, tom, horário, regras de transferência) antes de cada resposta, garantindo que mudanças no painel refletem imediatamente.

### Frontend

Reorganizar a aba "Agente IA (WhatsApp)" com sub-abas internas:

```text
Agente IA (WhatsApp)
├── Conexão          → WhatsAppIntegrationCard (existente)
├── Comportamento    → Nome, tom, prompt, horários, mensagens
├── Imóveis          → Toggle DB, whitelist/blacklist/destaque
├── Qualificação     → Auto-qualify, criar lead, atribuição
├── Transferência    → Keywords, fallback, notificações
└── Analytics        → Logs, métricas (futuro)
```

### Arquivos a criar/editar

1. **Migração SQL** — tabelas `whatsapp_agent_config` e `whatsapp_property_rules` com RLS
2. **`src/components/integrations/whatsapp-agent/`** — pasta com componentes das sub-abas:
   - `AgentBehaviorTab.tsx` — config de personalidade
   - `AgentPropertiesTab.tsx` — whitelist/blacklist/destaque com seletor de imóveis
   - `AgentQualificationTab.tsx` — regras de qualificação
   - `AgentTransferTab.tsx` — regras de transferência
3. **`src/hooks/useWhatsAppAgentConfig.ts`** — CRUD da config
4. **`src/hooks/useWhatsAppPropertyRules.ts`** — CRUD das regras de imóveis
5. **Edge Function `whatsapp-agent-properties`** — endpoint para N8N consultar imóveis
6. **Edge Function `whatsapp-agent-config`** — endpoint para N8N buscar config
7. **Atualizar `Automations.tsx`** — substituir o card simples pelo painel completo

