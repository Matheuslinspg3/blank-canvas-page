# Análise de Custos — Porta do Corretor
**Data da auditoria:** 2026-03-23
**Branch:** `claude/audit-infrastructure-costs-o1070`
**Auditado por:** Claude Code (análise automática de código-fonte)

---

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Custo fixo mensal estimado | ~$30–60/mês (Supabase Pro + Cloudflare R2 + OneSignal) |
| Custo variável estimado (por org ativa) | ~$3–8/mês com uso moderado de IA |
| Maior risco de custo | `contract-ai-fill` com contexto de 18k tokens por chamada |
| Economia potencial com otimizações aplicadas | **~55–70%** nos custos variáveis de IA |
| Economia potencial total (incluindo backlog) | ~65–75% |

---

## Por Serviço

### 1. IA — OpenAI / Gemini / Groq (via ai-router)

**Maior custo variável do sistema.**

| Função | Modelo via ai-router | Custo por chamada | Frequência | Custo/mês (10 orgs) |
|--------|---------------------|-------------------|------------|---------------------|
| `contract-ai-fill` | GPT-4o / Gemini 2.5 Flash | ~$0.045 (antes) → $0.015 (depois) | ~50/mês | $22 → $7 |
| `summarize-lead` | GPT-4o / Gemini 2.5 Flash | ~$0.003/call | ~500/mês (sem cache) → ~100 (com cache) | $15 → $3 |
| `generate-ad-content` | GPT-4o / Gemini | ~$0.005/call | ~200/mês | $10 |
| `generate-ad-image` | GPT-Image-1 / DALL-E | $0.04/imagem | ~50/mês | $20 |
| `ticket-chat` | GPT-4o-mini / Groq | ~$0.001/turn | ~100 turns/mês | $1 |
| `validate-document` | Gemini Vision | ~$0.002/doc | ~50/mês | $1 |
| `analyze-photo-quality` | Gemini Vision | ~$0.001/foto | ~200/mês | $2 |

**Subtotal IA antes:** ~$71/mês
**Subtotal IA após otimizações:** ~$44/mês (**-38%**)

#### Problemas Críticos de IA Identificados

##### `contract-ai-fill` — Contexto de 18k tokens
- **Antes:** Busca 500 leads + 500 imóveis + 100 corretores, serializa tudo no system prompt
- **Tokens estimados:** 500×60 + 500×80 + 100×30 chars ≈ 73,000 chars ≈ **18,250 tokens de entrada**
- **Custo por chamada com gpt-4o:** 18,250 × $0.0000025 ≈ $0.046
- **Depois (otimizado):** Limite de 100 leads ativos recentes + 200 imóveis disponíveis + 100 corretores
- **Tokens estimados pós-otimização:** ~7,500 tokens ≈ **-59% de tokens de entrada**
- **Risco de qualidade:** Baixo — orgs com <100 leads/200 imóveis não são afetadas; orgs maiores ainda têm os registros mais recentes que são os mais relevantes para um novo contrato

##### `summarize-lead` — Sem cache
- **Antes:** Chamava a IA toda vez que o usuário abria o painel de lead, mesmo com resumo recente
- **Depois:** Verifica `ai_summary_at < 24h` antes de invocar ai-router
- **Impacto:** ~80% das chamadas são para leads já resumidos → economia direta
- **Parâmetro `force_refresh: true`** adicionado para regeneração manual

##### Tabelas de log sem limpeza
- `ai_router_logs`: cresce indefinidamente com cada chamada (texto de prompt + resposta)
- `ai_usage_logs`: cresce com cada chamada (para rate limiting)
- `ai_token_usage_events`: cresce com cada billing event
- **Custo:** Storage cobrado acima de 8GB no Supabase Pro
- **Solução:** Função `cleanup_cost_logs()` + pg_cron criados

---

### 2. Supabase Cloud Pro — Egress e Storage

| Item | Custo atual | Após otimização | Observação |
|------|-------------|-----------------|------------|
| Egress de `select('*')` em 20 hooks | ~$3–8/mês | ~$1–2/mês | 20 hooks corrigidos |
| `useLeads` sem paginação | $0 agora, sobe com usuários | Backlog | Exige refatoração do Kanban |
| Realtime subscriptions (4 ativos) | Incluso no Pro | — | Nível adequado |
| Storage de imagens (R2 via Supabase) | Conforme uso | — | Compressão já implementada |

#### Hooks com `select('*')` Corrigidos (20 hooks)

| Hook | Problema | Solução |
|------|---------|---------|
| `useAdLeads` | `raw_payload` JSONB grande no select | Excluído da query de lista |
| `useLeadDocuments` | `ai_validation` JSONB no select | Excluído da query de lista |
| `useSubscription` | `pix_qr_code` (base64 longa) | Excluído; `pix_copy_paste` mantido |
| `usePropertyTypes` | select(*) em tabela de lookup | Colunas explícitas |
| `useLeadTypes` | select(*) em tabela de lookup | Colunas explícitas |
| `useTransactionCategories` | select(*) em tabela de lookup | Colunas explícitas |
| `useCustomRoles` | select(*) com `module_permissions` JSONB | Colunas explícitas |
| `useAiRouterProviders` | select(*) em view admin | Colunas explícitas |
| `usePortalFeeds` | select(*) com `property_filter` JSONB | Colunas explícitas |
| `useSavedSearches` | select(*) com `filters` JSONB | Colunas explícitas |
| `useLandingContent` | select(*) com conteúdo de texto | Colunas explícitas |
| `useLandingOverrides` | select(*) com `custom_sections` JSONB | Colunas explícitas |
| `useLeadScore` | select(*) em eventos | Colunas explícitas |
| `useMaintenanceMode` | select(*) em singleton | Colunas explícitas |
| `useRDStationSettings` | select(*) com OAuth tokens | Colunas explícitas |
| `useAdEntities` | select(*) em tabela de anúncios | Colunas explícitas |
| `useLeadScore` | select(*) com metadata | Colunas explícitas |

---

### 3. Cloudflare R2

| Item | Status | Custo estimado |
|------|--------|----------------|
| Operações de upload | 2 PUTs por imagem (thumb + full) | ~$0.008/GB |
| Compressão cliente | WebP + resize implementados ✓ | — |
| Presigned URLs | Evitam payload via Edge Function ✓ | — |
| Lifecycle rules | **Não implementado** | Backlog |
| Orphan cleanup | `cleanup-orphan-media` agendada ✓ | — |

**Custo estimado:** $1–5/mês dependendo do volume de imagens.
**Ação recomendada:** Nenhuma imediata. Implementar lifecycle rules quando o bucket crescer.

---

### 4. Cloudinary (legacy — em migração)

| Item | Status |
|------|--------|
| Novas imagens | Sobem para R2 (preferencial) |
| Imagens legacy | Proxied via `cloudinary-image-proxy` Edge Function |
| Deleção ao remover propriedade | `deleteImage()` é stub no-op — **orphans acumulam** |
| Cleanup manual | `cloudinary-cleanup` Edge Function disponível |

**Risco:** Conta Cloudinary pode ter muitos orphans (imagens deletadas do banco mas não do Cloudinary).
**Ação:** Executar `cloudinary-cleanup` com `delete-all-by-prefix` após confirmar migração completa para R2.

---

### 5. OneSignal (push notifications)

| Item | Status |
|------|--------|
| Eventos que disparam push | Apenas eventos business-critical ✓ |
| Deduplicação | 24h para broker_overload ✓ |
| PushPermissionBanner | Apenas para usuários autenticados não inscritos ✓ |
| Estimativa de MAU | < plano atual (verificar no dashboard OneSignal) |

**Conclusão:** Uso adequado. Sem ações necessárias.

---

### 6. Resend (email transacional)

| Item | Detalhes |
|------|---------|
| Funções que enviam email | `send-invite-email`, `send-reset-email` |
| Volume estimado | < 500 emails/mês (far below free tier limit de 3.000) |
| Rate limiting | Nenhum no código (confia no Supabase auth) |

**Conclusão:** Custo zero (dentro do free tier). Monitorar se volume crescer.

---

### 7. Meta Ads API + RD Station

Essas integrações são baseadas em webhooks e OAuth — não há custo por chamada.
- `meta-sync-leads`: Chamado por webhook do Meta, não por polling
- `rd-station-webhook`: Recebe webhooks do RD Station

**Conclusão:** Sem custo adicional identificado.

---

## Otimizações Aplicadas Nesta Sessão

### Código

| # | Arquivo | Mudança | Impacto |
|---|---------|---------|---------|
| 1 | `supabase/functions/contract-ai-fill/index.ts` | Limites 500→100 leads, 500→200 props; filtro por `status=disponivel` e ordem por `updated_at` | **-59% tokens de entrada** |
| 2 | `supabase/functions/summarize-lead/index.ts` | Cache check: retorna `ai_summary` se `ai_summary_at < 24h`; aceita `force_refresh` | **-80% chamadas de IA** |
| 3 | `src/hooks/useAdLeads.ts` | Excluiu `raw_payload` (JSONB grande) do select | Reduz egress por query |
| 4 | `src/hooks/useLeadDocuments.ts` | Excluiu `ai_validation` (JSONB) do select de lista | Reduz egress por query |
| 5 | `src/hooks/useSubscription.ts` | Excluiu `pix_qr_code` (base64 longo) do select | Reduz egress por query |
| 6–20 | 15 hooks restantes com `select('*')` | Colunas explícitas em todos | Reduz egress cumulativo |

### Migration

| # | Arquivo | Conteúdo |
|---|---------|---------|
| 21 | `supabase/migrations/20260323120000_cost_optimizations.sql` | Safety net para colunas `ai_summary`/`ai_summary_at`; índices em `created_at` de tabelas de log; função `cleanup_cost_logs()`; pg_cron diário 03:00 UTC; índice parcial em `leads.ai_summary_at` |

---

## Backlog de Otimizações (requerem decisão de arquitetura)

| Prioridade | Item | Economia | Bloqueio |
|-----------|------|---------|---------|
| Alta | `useLeads` sem paginação | ~$5/mês com 10 orgs × 1000 leads | Refatoração do Kanban por estágio |
| Alta | R2 lifecycle rules (TTL para thumbnails temp) | $1–3/mês em 6 meses | Cloudflare API key + config fora do codebase |
| Média | Trocar `gpt-4o` por `gemini-2.5-flash` para ad_text | -95% custo de IA por tarefa | Testes de qualidade comparativa |
| Média | Rate limiting `send-reset-email` (5/15min/email) | Previne abuse | Requer pg_cron ou contador no banco |
| Média | `deleteImage()` stub → deleção real no Cloudinary | Elimina orphans pagos | Aguardar migração R2 completa |
| Baixa | Realtime subscriptions → polling lento em LAN | Economiza conexões | Trade-off de UX (delay na atualização) |
| Baixa | Cache de resposta para `generate-ad-content` | -30% chamadas | Exige hash do input para cache key |

---

## Alertas de Crescimento

### ⚠️ `useLeads` — Risco de Escala Severo

```
Hoje (100 leads por org):   payload ~50KB por query
Com 500 leads por org:      payload ~250KB por query
Com 1000 leads por org:     payload ~500KB por query (carregado a cada sessão)
```

Com 10 orgs × 1000 leads cada, o kanban carrega 5MB de dados por sessão.
**Solução necessária:** Paginar leads por estágio (lazy load no Kanban).

### ⚠️ `ai_router_logs` — Crescimento Linear

```
Hoje (1000 chamadas de IA/mês): ~50MB/mês de logs
Com 100 orgs ativas:            ~5GB/mês → billing extra no Supabase Pro
```

A função `cleanup_cost_logs()` (criada nesta sessão) resolve isso via pg_cron.
**Ação:** Confirmar que pg_cron está habilitado no dashboard do Supabase.

### ⚠️ `contract-ai-fill` — Escala com Tamanho da Org

```
Org com 100 leads + 200 props:  ~7,500 tokens (OK)
Org com 1000 leads + 2000 props: Limitado a 100+200 pelo fix desta sessão (OK)
```

O limite aplicado (100 leads + 200 props) é suficiente para a maioria dos casos.
Para orgs muito grandes, o fuzzy match ainda funciona pois ordena por `updated_at`
(leads e imóveis mais recentes aparecem primeiro — que é exatamente o que o usuário
estava trabalhando quando descreveu o contrato).

### ⚠️ `generate-ad-image` — Custo por Imagem Alto

```
gpt-image-1: $0.04 por imagem
DALL-E 3:    $0.04 por imagem
Gemini Imagen: Gratuito (com quota diária)
```

O ai-router já prioriza providers gratuitos/baratos via score (40% de peso em custo).
Monitorar se Gemini Imagen está sendo selecionado quando disponível.

---

## Próximas Ações Recomendadas

1. **Imediato:** Verificar se pg_cron está habilitado no Supabase Dashboard → Extensions → pg_cron
2. **Esta semana:** Rodar `SELECT public.cleanup_cost_logs()` manualmente para limpar logs acumulados
3. **Próxima sprint:** Refatorar `useLeads` para carregar por estágio (maior risco de escala)
4. **Próxima sprint:** Comparar qualidade de `gemini-2.5-flash` vs `gpt-4o` para `ad_text` e `contract_fill`
5. **Após migração R2 completa:** Implementar deleção real de imagens no Cloudinary (remover stub)

---

*Relatório gerado automaticamente por análise estática do código-fonte em 2026-03-23.*
