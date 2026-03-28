

# Plano: Endpoint Unificado para Agente IA - Dados Completos por instance_name

## Problema

O N8N consulta a tabela `whatsapp_agent_config` diretamente, recebendo booleanos crus. Alem disso, falta um mapeamento de bairros com seus respectivos IDs de imoveis para a IA navegar o catalogo.

## Solucao

Atualizar a Edge Function `whatsapp-webhook-config` para retornar **tudo** que o agente precisa em uma unica chamada, incluindo:

1. **Prompts como texto** (ja existe, mas precisa garantir que o N8N use a Edge Function)
2. **Mapeamento de bairros** agrupando property IDs por `address_neighborhood`
3. **Mapeamento de cidades** agrupando por `address_city`

## Resposta Final do Endpoint

```text
POST whatsapp-webhook-config { instance_name: "xxx" }

Retorna:
{
  organization: { id, name, slug },
  instance: { instance_name, status, phone_number },
  
  // Prompt completo pronto para system message
  composed_system_prompt: "Voce e a Valentina... \n--- Instrucoes ---\n• Ao iniciar...",
  
  // Variaveis individuais (para usar como {{ qualify }} no N8N)
  prompt_variables: {
    qualify: "Ao iniciar uma conversa, colete nome completo...",
    create_lead: "Apos coletar os dados...",
    schedule: "Voce pode agendar visitas. Horarios: ...",
    properties: "Voce tem acesso ao banco de imoveis...",
    property_types: "Use o seguinte mapeamento..."
  },
  
  // Configs cruas (para logica condicional no N8N)
  agent_config: { agent_name, tone, welcome_message, away_message, ... },
  
  // Tipos de imovel: ID => Nome
  property_types: { "uuid-1": "Apartamento", "uuid-2": "Casa" },
  
  // NOVO: Bairros com IDs dos imoveis disponiveis
  neighborhoods: {
    "Centro": ["prop-id-1", "prop-id-3"],
    "Jardim Paulista": ["prop-id-2", "prop-id-5"]
  },
  
  // Imoveis disponiveis (com property_type_name e featured)
  properties: {
    enabled: true,
    items: [ { id, title, property_type_name, address_neighborhood, featured, ... } ],
    total: 15
  }
}
```

## Alteracoes

### 1. Edge Function `whatsapp-webhook-config/index.ts`

Adicionar apos buscar os imoveis:
- Agrupar propriedades por `address_neighborhood` gerando um map `{ bairro: [ids] }`
- Usar coluna `featured` diretamente da tabela `properties` (em vez da tabela de rules)
- Incluir `neighborhoods` no response JSON

### 2. Edge Function `whatsapp-agent-config/index.ts`

Mesma logica de neighborhoods para manter consistencia entre os dois endpoints.

## Detalhes Tecnicos

- Nenhuma migracao necessaria (coluna `featured` ja existe em `properties`)
- Bairros sao extraidos dos imoveis ja carregados (sem query extra)
- A coluna `featured` substitui a consulta a `whatsapp_property_rules` para destaques

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/whatsapp-webhook-config/index.ts` | Adicionar neighborhoods map, usar featured direto |
| `supabase/functions/whatsapp-agent-config/index.ts` | Mesmo ajuste de neighborhoods |

