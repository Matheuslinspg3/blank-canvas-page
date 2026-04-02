

## Integração ai-router + N8N + Billing de Tokens

### Esclarecimento: N8N aceita HTTP Request

O N8N tem o node **HTTP Request** que faz chamadas HTTP para qualquer endpoint, incluindo Edge Functions do Supabase. No workflow do WhatsApp, em vez de usar nodes nativos de IA (que dão problemas de versão), você usa:

```text
┌─────────────────┐     ┌──────────────────────────────┐     ┌─────────────────┐
│  Mensagem chega  │────▶│  HTTP Request → ai-router     │────▶│  Resposta da IA  │
│  (webhook N8N)   │     │  POST /ai-router               │     │  com tokens      │
└─────────────────┘     └──────────────────────────────┘     └─────────────────┘
```

**Configuração no N8N (node HTTP Request):**
- **Method**: POST
- **URL**: `https://zpajuxxsxrwuqregdzjm.supabase.co/functions/v1/ai-router`
- **Headers**: `Authorization: Bearer <SUPABASE_ANON_KEY>`, `Content-Type: application/json`
- **Body**:
```json
{
  "task_type": "whatsapp_agent",
  "prompt": "{{ mensagem do cliente }}",
  "system_prompt": "{{ composed_system_prompt do webhook-config }}",
  "organization_id": "{{ org_id }}",
  "user_id": "system"
}
```

A resposta já retorna `tokens_input`, `tokens_output`, `estimated_cost_usd` — tudo que você precisa.

---

### O que falta implementar (código)

#### 1. Adicionar `trackAiBilling` no ai-router (1 arquivo)

**Arquivo:** `supabase/functions/ai-router/index.ts`

Após o sucesso (~linha 835), adicionar chamada fire-and-forget ao `trackAiBilling` para registrar na tabela `ai_token_usage_events` (sistema de billing/faturamento), além do `trackStats` já existente (que alimenta `ai_router_stats`).

```typescript
import { trackAiBilling } from "../_shared/ai-billing.ts";

// Após linha 835 (trackStats), adicionar:
trackAiBilling(supabase, {
  userId: userId || "system",
  organizationId: orgId,
  provider: provider.provider_type,
  model: provider.model_id,
  functionName: `ai-router/${task_type}`,
  inputTokens: result.tokens_input,
  outputTokens: result.tokens_output,
  success: true,
  usageType: config.complexity === "image" ? "image" : "text",
}).catch(() => {});
```

No bloco de falha total (~linha 913), registrar com `success: false`.

#### 2. Criar endpoint `whatsapp-track-usage` (1 arquivo novo)

Para cenários onde o N8N chama LLMs diretamente (sem o ai-router), criar um endpoint leve para reportar uso.

**Arquivo:** `supabase/functions/whatsapp-track-usage/index.ts`

- Auth via `X-Webhook-Secret` (WHATSAPP_AGENT_SECRET)
- Resolve `organization_id` a partir de `instance_name`
- Chama `trackAiBilling`

Payload do N8N:
```json
{
  "instance_name": "org-xyz",
  "provider": "openai",
  "model": "gpt-4o",
  "input_tokens": 1250,
  "output_tokens": 380
}
```

---

### Resultado

| Cenário | Tracking |
|---|---|
| N8N chama ai-router (recomendado) | Automático — ai-router registra no billing |
| N8N chama LLM diretamente | N8N faz POST para `whatsapp-track-usage` após a chamada |

O dashboard de billing passa a exibir custos reais de IA do WhatsApp por organização, e os orçamentos (`ai_org_budgets`) são respeitados.

### Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/ai-router/index.ts` | Adicionar import + chamada `trackAiBilling` |
| `supabase/functions/whatsapp-track-usage/index.ts` | Criar endpoint para N8N reportar uso direto |

