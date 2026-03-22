

## AI Router — Auditoria Completa e Correções

### Problemas Encontrados

1. **`list-ai-models` sem `verify_jwt = false` no config.toml** — A Edge Function de descoberta de modelos não está no config.toml, causando rejeição 401 pelo gateway ao tentar criar novos providers no wizard.

2. **Função `upsertStats` morta (linhas 281-344 do ai-router)** — Nunca é chamada. Apenas `trackStats` é usado. Código morto poluindo o arquivo.

3. **RPD Progress bar com classes Tailwind dinâmicas** — `[&>div]:${rpdColor(rpdPct)}` gera classes como `[&>div]:bg-red-500` dinamicamente, que o Tailwind não detecta no build. A barra ficará sem cor.

4. **Score Progress bar usa `--progress-color` CSS variable** — O componente `Progress` (shadcn) usa `bg-primary` hardcoded no Indicator, ignorando qualquer CSS variable custom. A cor do score não funciona.

5. **`trackStats` com race condition** — Padrão read-then-write sob concorrência perde dados (duas requests simultâneas leem o mesmo valor, ambas escrevem +1 ao invés de +2). Deve usar uma DB function com operações atômicas.

6. **`useAiRouterProviderStats` usa `(supabase as any)`** — A tabela `ai_router_provider_stats` já existe no types.ts, então o cast para `any` é desnecessário e perde type safety.

---

### Plano de Correção

#### 1. Adicionar `list-ai-models` ao config.toml
Adicionar `[functions.list-ai-models]` com `verify_jwt = false`.

#### 2. Remover `upsertStats` morto do ai-router
Deletar linhas 279-344 (a função `upsertStats` que nunca é chamada).

#### 3. Criar DB function para stats atômicos
Criar uma migration com uma função SQL `upsert_ai_router_stats` que faz INSERT...ON CONFLICT com incrementos atômicos. Substituir a lógica read-then-write do `trackStats` por uma chamada RPC.

#### 4. Corrigir Progress bars no Overview
- **RPD bar**: Usar `style` inline no Indicator ao invés de classes Tailwind dinâmicas. Para isso, criar um componente `ColorProgress` que aceita uma prop `indicatorColor`.
- **Score bar**: Mesmo approach — usar `style` inline.

#### 5. Remover cast `as any` no hook de stats
Usar o tipo correto do Supabase client.

---

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `supabase/config.toml` | Adicionar `list-ai-models` com verify_jwt = false |
| `supabase/functions/ai-router/index.ts` | Remover `upsertStats`; substituir `trackStats` por chamada RPC |
| Migration SQL | Criar function `upsert_ai_router_stats` atômica |
| `src/components/developer/ai-router/AiRouterOverview.tsx` | Corrigir Progress bars com cores inline |
| `src/hooks/useAiRouterProviderStats.ts` | Remover cast `as any` desnecessário |

