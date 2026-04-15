

# Plano: Refatorar System Prompt base e corrigir envio de fotos de imóveis

## Problemas identificados

### 1. System Prompt base incompleto
O `composed_system_prompt` em `whatsapp-webhook-config` é montado assim:
```
[prompt do usuário]
--- Instruções ---
• qualificação
• criação de lead
• agendamento
• imóveis
• tipos de imóvel
```

**Faltam instruções fundamentais** para o agente:
- Não instrui a IA a **enviar fotos** quando apresentar imóveis
- Não explica que a IA tem **ferramentas (tools)** disponíveis como `whatsapp-send-property-photos`, `whatsapp-property-images`, `whatsapp-agent-properties`
- Não orienta formato de apresentação de imóveis (listar com dados relevantes)
- Não instrui a IA sobre como usar `cover_image_url` já retornado por `whatsapp-agent-properties`

### 2. Fotos não são enviadas pela IA
A cadeia de envio de fotos existe e está funcional:
- `whatsapp-agent-properties` já retorna `cover_image_url` para cada imóvel
- `whatsapp-property-images` busca URLs de imagens
- `whatsapp-send-property-photos` faz busca + envio unificado
- `whatsapp-send-media` envia imagens avulsas

**O problema é no n8n**: o Agente IA precisa ter uma **tool** configurada que chame `whatsapp-send-property-photos` quando apresentar imóveis. Se a tool existe no n8n mas a IA não sabe que deve usá-la, é porque o system prompt não instrui.

## Plano de implementação

### Passo 1: Refatorar `composed_system_prompt` em `whatsapp-webhook-config`
Adicionar um bloco de instruções base **antes** do prompt do usuário, com:

```
--- Identidade ---
Você é {agent_name}, assistente virtual da imobiliária {org_name}.
Tom de comunicação: {tone}.

--- Ferramentas disponíveis ---
• Quando apresentar imóveis ao cliente, SEMPRE use a ferramenta de envio de fotos para enviar a imagem de capa de cada imóvel mencionado.
• Para buscar imóveis use a ferramenta de busca de propriedades com os filtros adequados.
• Para enviar fotos dos imóveis apresentados, use a ferramenta de envio de fotos informando os property_ids.
• Para criar/atualizar leads, use as ferramentas de lead.
• Para transferir para humano, use a ferramenta de transbordo.

--- Regras de apresentação de imóveis ---
• Ao recomendar imóveis, apresente de forma resumida: título, tipo, bairro/cidade, preço e metragem.
• SEMPRE envie a foto de capa junto com a apresentação do imóvel.
• Não liste mais de 5 imóveis por vez; pergunte se quer ver mais.

--- Instruções operacionais ---
• {qualificação}
• {criação de lead}
• {agendamento}
• {imóveis}
• {tipos de imóvel}
```

### Passo 2: Garantir que a tool `whatsapp-send-property-photos` esteja configurada no n8n
Isso é no lado n8n (workflow HyoHStUv2ZhXnnTG). A tool precisa:
- Receber `property_ids`, `phone`, `instance_name`
- Chamar a Edge Function `whatsapp-send-property-photos` com `mode: "cover"`

### Arquivos alterados
- `supabase/functions/whatsapp-webhook-config/index.ts` — refatorar montagem do `composed_system_prompt`

### Impacto
- O prompt base passa a instruir a IA sobre as ferramentas disponíveis e sobre o envio obrigatório de fotos
- O `config.system_prompt` do usuário continua sendo respeitado (injetado dentro do prompt composto)
- Sem breaking changes no payload de saída

