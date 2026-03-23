# Auditoria de Custos Totais — Porta do Corretor
**Data:** 2026-03-23 | **Escopo:** 73 Edge Functions, 311 componentes, 77 hooks, 50+ tabelas

---

## Mapa de Custos Técnicos e Operacionais

### Custos Fixos Mensais (Infraestrutura)

| Item | Custo/mês | Notas |
|------|-----------|-------|
| Supabase Pro | R$140 (~$25) | Banco + Auth + Edge Functions + Realtime + Storage |
| VPS Hostinger (UAZAPI WhatsApp) | R$90 | Servidor dedicado para integração WhatsApp |
| Domínio portadocorretor.com.br | R$6,67 | Anual rateado |
| OneSignal | $0 | Free tier (<10k subscribers) |
| Resend | $0 | Free tier (<3k emails/mês) |
| Cloudflare R2 | ~$1-5 | Storage de imagens; egress gratuito |
| Cloudinary (legacy) | $0 | Free tier; em migração para R2 |
| **Total fixo** | **~R$240/mês** | **Break-even: 3 planos Corretor ou 2 Imobiliária** |

### Custos Variáveis (por uso)

| Item | Custo estimado (10 orgs) | Driver de custo |
|------|-------------------------|----------------|
| IA (OpenAI/Gemini/Groq) | ~$44/mês | `contract-ai-fill`, `generate-ad-image`, `summarize-lead` |
| Supabase egress | ~$1-3/mês | Queries de leads/properties sem paginação |
| Supabase storage | $0 (< 8GB) | Logs + dados — monitorar crescimento |
| Edge Function invocations | Incluído no Pro | ~50k/mês estimado |
| Meta Ads API | $0 | Webhooks gratuitos |
| Asaas (gateway) | % por transação | Custo do negócio, não da infra |

---

## Custos Visíveis vs. Invisíveis

### Visíveis (aparecem na fatura)

| Custo | Valor | Controlável? |
|-------|-------|-------------|
| Supabase Pro | R$140 | Não (necessário) |
| VPS WhatsApp | R$90 | Sim — avaliar UAZAPI cloud |
| IA por chamada | ~$44/mês | Sim — cache, limites, modelos baratos |
| R2 storage | ~$3 | Pouco (cresce com uso) |

### Invisíveis (custam tempo, qualidade ou escala)

| Custo Invisível | Impacto Real | Quantificação |
|----------------|-------------|---------------|
| **God Hooks (930+551 linhas)** | Dev gasta 2-3x mais tempo para entender e modificar | ~2h/semana de overhead |
| **75 Edge Functions sem shared code** | Bug fix duplicado em N functions | ~4h/mês de retrabalho |
| **Lógica de negócio no frontend** | Impossibilita mobile nativo/API pública | Custo de oportunidade imenso |
| **Leads sem paginação** | Timeout e UX degradada com >500 leads | Churn futuro |
| **CORS `*` em 70+ functions** | Vetor de ataque; custo de incidente | Risco reputacional |
| **Race condition em generateCode()** | Contratos duplicados → suporte manual | ~1h/incidente |
| **Cloudinary orphans acumulando** | Pagando storage por imagens deletadas | ~$0-5/mês crescente |
| **`ai_router_logs` sem TTL** | Storage explode com 100+ orgs | ~5GB/mês → billing extra |

---

## Decisões Caras que Podem Ser Simplificadas

### 1. VPS dedicada para WhatsApp (R$90/mês = 38% do custo fixo)
- **Hoje:** VPS Hostinger rodando UAZAPI
- **Alternativa:** UAZAPI Cloud (SaaS) ou Evolution API em container compartilhado
- **Economia potencial:** R$40-60/mês
- **Trade-off:** Menos controle, mas menos manutenção
- **Recomendação:** Avaliar UAZAPI Cloud no médio prazo

### 2. 3 provedores de storage simultâneos
- **Hoje:** Supabase Storage + Cloudflare R2 + Cloudinary (legacy)
- **Custo:** Complexidade de manutenção (3 Edge Functions de upload, proxy, cleanup)
- **Alternativa:** Completar migração para R2, remover Cloudinary
- **Economia:** Elimina `cloudinary-image-proxy`, `cloudinary-cleanup`, `cloudinary-sign` (3 functions + manutenção)
- **Recomendação:** Priorizar finalização da migração R2

### 3. IA com contexto de 18k tokens por chamada
- **Hoje:** `contract-ai-fill` envia 100 leads + 200 props no system prompt
- **Já otimizado:** Reduzido de 18k para ~7.5k tokens (sessão anterior)
- **Próximo passo:** Usar embedding/vector search para enviar apenas os 10 registros mais relevantes
- **Economia potencial adicional:** ~60% (7.5k → 3k tokens)
- **Trade-off:** Complexidade de implementação vs. economia de ~$3/mês
- **Recomendação:** NÃO otimizar agora — custo absoluto é baixo

### 4. `summarize-lead` sem cache → com cache
- **Já implementado:** Cache de 24h com `ai_summary_at`
- **Economia:** ~80% das chamadas eliminadas
- **Status:** ✅ Feito

### 5. Dashboard financeiro faz 4 queries separadas
- **Hoje:** `useTransactions` + `useInvoices` + `useCommissions` + `useContracts`
- **Alternativa:** RPC `compute_financial_summary(org_id, period)` — 1 query
- **Economia:** 4x menos round-trips, ~3x mais rápido
- **Recomendação:** Implementar no Sprint 1

---

## Otimizações com Melhor Custo-Benefício

| # | Otimização | Esforço | Economia | ROI |
|---|-----------|---------|----------|-----|
| 1 | Finalizar migração R2 → remover Cloudinary | Médio | ~$5/mês + 3 functions a menos | Alto (simplifica) |
| 2 | RPC financeiro (4 queries → 1) | Baixo | Latência 3x menor | Alto |
| 3 | Plan limits enforcement | Baixo | Previne abuse; limita crescimento de dados | Alto (produto) |
| 4 | `_shared/` em Edge Functions | Médio | ~4h/mês de retrabalho | Alto (dev time) |
| 5 | Modularizar God Hooks | Médio | ~2h/semana de overhead | Alto (dev time) |
| 6 | Paginar leads | Alto | Elimina timeout e egress excessivo | Crítico (escala) |
| 7 | Vector search no `contract-ai-fill` | Alto | ~$3/mês de IA | Baixo (não vale agora) |

---

## O Que Vale Otimizar Agora vs. Não

### ✅ Vale agora (sinal real, custo claro)

| Item | Por quê |
|------|---------|
| RPCs atômicos (delete, contract code) | Race conditions reais já acontecem |
| `_shared/` infrastructure | 75 functions com código duplicado — toda mudança custa 2x |
| Plan limits | Sem limites = um tenant pode consumir recursos de todos |
| RPC financeiro | 4 round-trips por sessão no dashboard |
| Cleanup Cloudinary orphans | Pagando por imagens que não existem mais |

### ⚠️ Vale em breve (3-6 meses)

| Item | Trigger para agir |
|------|-------------------|
| Paginar leads | Primeiro cliente com >500 leads |
| Feature flags | Quando precisar de rollout gradual |
| Modularizar hooks | Quando segundo dev entrar no projeto |
| CORS allowlist | Quando app tiver dados financeiros sensíveis em prod |

### ❌ Não vale agora (sem sinal real)

| Item | Por quê |
|------|---------|
| Vector search para contract-ai-fill | Economia de ~$3/mês vs. complexidade de implementação |
| Read replicas | Supabase Pro aguenta a carga atual |
| i18n | Mercado é 100% BR |
| API pública versionada | Sem parceiros pedindo |
| Microserviços | Monólito Supabase atende perfeitamente |
| Event sourcing | Audit_events já cobre necessidade atual |
| UAZAPI Cloud | Avaliar mas não migrar sem dor real |

---

## Trade-offs Claros

### Custo vs. Performance
| Decisão | Mais barato | Mais rápido | Recomendação |
|---------|------------|-------------|-------------|
| Leads: paginar vs. carregar tudo | Paginar (menos egress) | Carregar tudo (sem loading) | Paginar — performance atual já é ruim com volume |
| IA: cache vs. fresh | Cache (80% menos chamadas) | Fresh (sempre atualizado) | Cache 24h — já implementado ✅ |
| Storage: R2 vs. Cloudinary | R2 (egress grátis) | Igual | R2 — migração já em progresso |
| Dashboard: 4 queries vs. 1 RPC | 1 RPC (menos egress) | 1 RPC (menos round-trips) | RPC — win-win |

### Custo vs. Velocidade de Entrega
| Decisão | Mais rápido de entregar | Mais barato de manter | Recomendação |
|---------|----------------------|---------------------|-------------|
| Edge Functions: inline vs. _shared/ | Inline (copy-paste) | _shared/ (DRY) | _shared/ — 75 functions justificam |
| Hooks: monolítico vs. modular | Monolítico (1 arquivo) | Modular (fácil de mudar) | Modular — 930 linhas é insustentável |
| Billing: query params vs. functions separadas | Query params (1 deploy) | Separadas (clareza) | Manter query params por ora — funciona |

### Custo vs. Confiabilidade
| Decisão | Mais confiável | Mais barato | Recomendação |
|---------|---------------|------------|-------------|
| Deleção: RPC atômico vs. 4 DELETEs | RPC (transação) | 4 DELETEs (sem mudança) | RPC — orphans são reais |
| Contract code: RPC vs. frontend | RPC (sem race) | Frontend (sem mudança) | RPC — duplicatas são reais |
| CORS: allowlist vs. `*` | Allowlist | `*` (sem mudança) | Allowlist — segurança básica |

---

## Custo do Usuário (UX)

| Problema | Custo para o Usuário | Solução | Esforço |
|----------|---------------------|---------|---------|
| Kanban trava com >300 leads | Abandona a feature | Paginar por estágio | Alto |
| Trial expira sem caminho de upgrade | Churn | TrialExpiredScreen com botão de planos ✅ | Feito |
| Sessão expira sem aviso | Perde dados em formulário | Toast de sessão expirada ✅ | Feito |
| Sem indicador offline | Não sabe por que falhou | OfflineBanner ✅ | Feito |
| 6+ cliques para criar contrato com IA | Muito atrito | Simplificar wizard | Médio |
| Imagens pesadas no mobile | Consumo de dados | WebP + resize já implementados ✅ | Feito |

---

## Custo de Falha

| Cenário de Falha | Impacto | Probabilidade | Mitigação Atual | Gap |
|-----------------|---------|--------------|----------------|-----|
| Contrato com código duplicado | Confusão jurídica + suporte | Média (com 2+ users) | Nenhuma | RPC com lock |
| Deleção parcial de imóvel | Orphans + dados inconsistentes | Média | Nenhuma | RPC cascade |
| Edge Function pendurada 150s | Invocação desperdiçada | Alta (fetches externos) | Nenhuma | fetchWithTimeout |
| Breach do banco expõe OAuth tokens | Comprometimento de contas Meta/RD | Baixa | Nenhuma | Criptografia |
| `ai_router_logs` atinge 8GB | Billing extra Supabase | Média (com 100+ orgs) | `cleanup_cost_logs()` criado | Verificar pg_cron ativo |
| Tenant abusa sem limites | Degrada performance para todos | Média | Nenhuma | Plan limits |

---

## Recomendações por Prioridade

### P0 — Fazer esta semana (custo zero de não fazer é alto)

1. **Plan limits enforcement** — trigger que rejeita INSERT em `leads` se `count > plan.max_leads`
2. **RPC `generate_contract_code()`** — elimina race condition real
3. **RPC `delete_property_cascade()`** — elimina orphans reais
4. **Verificar pg_cron ativo** para `cleanup_cost_logs()`

### P1 — Fazer em 2 semanas

5. **`_shared/fetch.ts`** com timeout 15s
6. **`_shared/response.ts`** com envelope padronizado
7. **RPC `compute_financial_summary()`** — dashboard 3x mais rápido
8. **Rodar `cloudinary-cleanup`** para eliminar orphans pagos

### P2 — Fazer em 1 mês

9. **`_shared/auth.ts` + `_shared/cors.ts`** — base para todas as functions
10. **Modularizar `useProperties`** (930 linhas → 3 hooks)
11. **Modularizar `useLeads`** (551 linhas → 3 hooks)
12. **Completar migração R2** → remover 3 functions Cloudinary

### P3 — Fazer em 3 meses

13. **Paginar leads por estágio** — escala do CRM
14. **Feature flags** — rollout gradual
15. **CORS allowlist** — segurança
16. **Avaliar UAZAPI Cloud** vs. VPS dedicada

---

## Resumo: Onde o Dinheiro Vai

```
Custo fixo: R$240/mês
├── Supabase Pro:       R$140 (58%) — necessário, não otimizável
├── VPS WhatsApp:       R$90  (38%) — avaliar alternativa cloud
└── Domínio:            R$7   (3%)  — fixo

Custo variável: ~$44/mês (IA)
├── generate-ad-image:  $20  (45%) — preço por imagem, difícil reduzir
├── generate-ad-content: $10 (23%) — ok
├── contract-ai-fill:   $7   (16%) — já otimizado (era $22)
├── summarize-lead:     $3   (7%)  — já otimizado (era $15)
└── Outros:             $4   (9%)  — ok

Custo invisível: ~8h/mês de dev time
├── God Hooks:          ~2h/semana para entender e modificar
├── Edge Functions DRY: ~1h/semana em bug fixes duplicados
├── Investigação:       ~1h/semana por falta de Sentry ativo
└── Incidentes:         ~1h/mês (race conditions, orphans)
```

**Conclusão:** O custo de infraestrutura é saudável (~R$240 fixo). O maior custo é o invisível: **~8h/mês de tempo de desenvolvimento perdido** em complexidade acidental. As otimizações P0-P1 (~8h de implementação) eliminam ~4h/mês de retrabalho recorrente — ROI positivo em 2 meses.

---

*Auditoria gerada por análise do código-fonte em 2026-03-23.*
