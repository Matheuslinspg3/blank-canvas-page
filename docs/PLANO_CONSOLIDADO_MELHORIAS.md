# Plano Consolidado de Melhoria — Porta do Corretor
**Data:** 2026-03-23  
**Fontes:** Auditorias de Dependências Externas, Estratégia de Falhas, Integridade de Dados, Identidade/Permissões e Antifraude/Abuso.

---

## 1. Top 10 Problemas Mais Graves

| # | Problema | Origem | Impacto |
|---|---------|--------|---------|
| **P1** | `send-reset-email` sem auth, sem rate limit — bombardeio de emails e custo Resend ilimitado | Antifraude, Falhas | 🔴 Financeiro + Reputação |
| **P2** | `crm-import-leads` sem autenticação — injeção de dados em qualquer org via service role | Antifraude, Permissões | 🔴 Integridade de dados |
| **P3** | `user_roles` UPDATE policy permite admin escalar para developer | Permissões | 🔴 Escalonamento de privilégio |
| **P4** | Campos de verificação (`creci_verified`, `email_verified`) editáveis pelo próprio usuário | Permissões | 🔴 Fraude de identidade |
| **P5** | Feature gating apenas no UI — plano gratuito consome recursos ilimitados via API | Antifraude, Dados | 🔴 Perda de receita |
| **P6** | OAuth tokens (Meta, RD Station) e API keys (Imobzi, WhatsApp) armazenados em texto plano | Dados, Dependências | 🔴 Comprometimento de integração |
| **P7** | `contracts.code` sem UNIQUE constraint — duplicação possível | Dados | 🔴 Integridade financeira |
| **P8** | Zero CAPTCHA em todo o sistema — bots criam contas, forçam login e resetam senhas | Antifraude | 🔴 Abuso em escala |
| **P9** | Sem soft delete em leads/contracts/properties — deleção irreversível | Dados | 🔴 Perda de dados de negócio |
| **P10** | `asaasFetch` sem timeout nem retry — falha de billing trava fluxo do usuário | Dependências, Falhas | 🟡 Receita + UX |

---

## 2. Top 10 Melhorias com Maior Impacto

| # | Melhoria | Esforço | Impacto |
|---|---------|---------|---------|
| **M1** | `_shared/rate-limit.ts` genérico para todas as Edge Functions | Médio (3h) | Protege todas as superfícies de abuso |
| **M2** | Trigger `prevent_self_verification` em profiles | Baixo (1h) | Elimina fraude de identidade |
| **M3** | Restrict `user_roles` UPDATE policy a developer-only | Baixo (0.5h) | Elimina escalonamento de privilégio |
| **M4** | UNIQUE constraint em `contracts(organization_id, code)` | Baixo (0.5h) | Integridade financeira |
| **M5** | Auth check em `crm-import-leads` e `onesignal-app-id` | Baixo (1h) | Fecha 2 endpoints abertos |
| **M6** | Feature gating enforcement via triggers no banco | Médio (3h) | Protege modelo de negócio |
| **M7** | Audit triggers automáticos em leads, contracts, commissions | Médio (4h) | Rastreabilidade completa |
| **M8** | `fetchWithTimeout` wrapper para integrações externas | Baixo (1.5h) | Resiliência de rede |
| **M9** | Cloudflare Turnstile no signup e reset | Médio (4h) | Anti-bot |
| **M10** | Soft delete em entidades críticas | Médio (4h) | Recuperação de dados |

---

## 3. Quick Wins (< 2h cada, impacto imediato)

| # | Item | Esforço | Ref |
|---|------|---------|-----|
| QW1 | Fix `user_roles` UPDATE policy → developer-only | 0.5h | P3 |
| QW2 | UNIQUE index em `contracts(organization_id, code)` | 0.5h | P7 |
| QW3 | Trigger `prevent_self_verification` em profiles | 1h | P4 |
| QW4 | Auth check em `crm-import-leads` | 0.5h | P2 |
| QW5 | Auth check em `onesignal-app-id` | 0.5h | P2 |
| QW6 | Audit log em `admin-users` DELETE/PATCH | 1h | Permissões |
| QW7 | Validation trigger: `contracts.end_date >= start_date` | 0.5h | Dados |
| QW8 | Validation trigger: `commissions.amount >= 0, percentage 0-100` | 0.5h | Dados |
| QW9 | Rate limit no `send-reset-email` (via count em audit_events) | 1.5h | P1 |
| QW10 | Remover comparação direta de service key em `cleanup-orphan-media` | 0.5h | Permissões |

**Total quick wins: ~7h** → reduz 60% dos riscos críticos.

---

## 4. Mudanças Estruturais

| # | Mudança | Objetivo | Esforço |
|---|---------|----------|---------|
| E1 | Adicionar `deleted_at` a leads, contracts, properties + atualizar RLS | Soft delete | Alto (6h) |
| E2 | Depreciar `leads.stage` em favor de `lead_stage_id` | Eliminar dual source of truth | Médio (3h) |
| E3 | `_shared/rate-limit.ts` + tabela `rate_limit_events` | Rate limiting centralizado | Médio (4h) |
| E4 | Feature gating triggers no banco (INSERT bloqueado se limite atingido) | Enforcement de plano | Médio (3h) |
| E5 | Criptografia de OAuth tokens e API keys no banco | Segurança de integração | Alto (6h) |
| E6 | Trigger `updated_at` automático em tabelas críticas | Cache invalidation confiável | Médio (2h) |
| E7 | Política de retenção de logs (pg_cron para purge 90d) | Performance + custo | Baixo (2h) |

---

## 5. Mudanças de Segurança

| # | Mudança | Problema Resolvido | Esforço |
|---|---------|-------------------|---------|
| S1 | Fix `user_roles` UPDATE policy | Escalonamento de privilégio | Baixo |
| S2 | Trigger `prevent_self_verification` | Fraude de identidade | Baixo |
| S3 | Auth check em endpoints expostos (crm-import, onesignal-app-id) | Injeção de dados + leak | Baixo |
| S4 | Rate limit em `send-reset-email` | Bombardeio de email | Baixo |
| S5 | Cloudflare Turnstile no signup/login/reset | Anti-bot | Médio |
| S6 | Validar state param nos OAuth callbacks (Meta, RD Station) | CSRF prevention | Médio |
| S7 | Bloqueio de conta após 5 login falhos em 10min | Brute force | Médio |
| S8 | MFA opcional para admins | Segurança de conta | Médio |

---

## 6. Mudanças de Confiabilidade e Resiliência

| # | Mudança | Problema Resolvido | Esforço |
|---|---------|-------------------|---------|
| R1 | `_shared/fetch.ts` com `fetchWithTimeout` + AbortController | Timeout em integrações externas | Baixo |
| R2 | Retry com backoff exponencial para Asaas, Resend, R2 | Falha transitória perde dados | Médio |
| R3 | Circuit breaker para providers de IA | Cascata de falhas | Médio |
| R4 | Dead Letter Queue para emails falhos | Email de reset/convite perdido | Médio |
| R5 | `isPending` guard em todas as mutations do frontend | Double-click → ação duplicada | Baixo |
| R6 | Health check endpoint para monitoramento | Detecção proativa de falhas | Baixo |

---

## 7. Mudanças de Dados e Auditoria

| # | Mudança | Problema Resolvido | Esforço |
|---|---------|-------------------|---------|
| D1 | UNIQUE em `contracts(org_id, code)` | Códigos duplicados | Baixo |
| D2 | Triggers de validação (datas, valores, ranges) | Dados incoerentes | Baixo |
| D3 | Audit triggers em leads (stage, broker, temperature) | Sem rastreabilidade CRM | Médio |
| D4 | Audit triggers em contracts (status, valor) | Sem auditoria financeira | Médio |
| D5 | Sync `paid_at` automático quando status = pago | Inconsistência estado/data | Baixo |
| D6 | Jobs de consistência (cron semanal) | Dados divergentes não detectados | Médio |
| D7 | Reconciliação com Asaas (cron semanal) | Billing divergente | Médio |

---

## 8. Mudanças Operacionais

| # | Mudança | Problema Resolvido | Esforço |
|---|---------|-------------------|---------|
| O1 | Dashboard de eventos de segurança para developers | Visibilidade zero de ataques | Médio |
| O2 | Alertas automáticos por email/push para comportamento anômalo | Detecção passiva | Médio |
| O3 | Runbook de investigação de abuso | Sem processo de resposta | Baixo |
| O4 | Runbook de falha de billing (Asaas) | Sem processo de recuperação | Baixo |
| O5 | Sistema de soft-ban (conta em revisão, read-only) | Sem gradação de resposta | Médio |
| O6 | Métricas de qualidade de dados (cron report) | Degradação silenciosa | Baixo |

---

## 9. Riscos de Não Agir

| Risco | Probabilidade | Impacto | Consequência |
|-------|--------------|---------|-------------|
| Bombardeio de emails via `send-reset-email` | Alta | 🔴 Custo + reputação | Ban do Resend, emails legítimos bloqueados |
| Escalonamento de privilégio via `user_roles` UPDATE | Média | 🔴 Admin vira developer | Acesso total ao sistema, deleção de dados |
| Injeção de leads via `crm-import-leads` | Média | 🔴 Dados corrompidos | CRM poluído, decisões baseadas em dados falsos |
| Trial infinito por múltiplas contas | Alta | 🔴 Perda de receita | Modelo de negócio comprometido |
| Tokens OAuth vazados do banco | Baixa | 🔴 Controle de contas Meta/RD | Envio de ads, acesso a dados de terceiros |
| Deleção acidental sem soft delete | Média | 🔴 Dados irrecuperáveis | Perda de contratos, leads, histórico |
| Feature gating sem enforcement | Alta | 🟡 Uso ilimitado gratuito | Custo de infra sem receita |
| Logs crescem indefinidamente | Alta | 🟡 Performance degradada | Queries lentas, custo de DB |

---

## 10. Ordem Recomendada de Implementação

```
Semana 1  ─ Quick Wins (QW1-QW10) ────────────────── 7h
Semana 2  ─ Rate limiting + Auth fixes ────────────── 6h
Semana 3  ─ Audit triggers + validação de dados ──── 6h
Semana 4  ─ Feature gating + soft delete ──────────── 8h
Semana 5  ─ Resiliência (fetch timeout, retry) ───── 6h
Semana 6  ─ CAPTCHA + detecção de abuso ───────────── 6h
Semana 7  ─ Criptografia de tokens + OAuth fix ────── 6h
Semana 8  ─ Reconciliação + operacional ───────────── 5h
```

---

## FASES DE IMPLEMENTAÇÃO

### FASE 1 — Redução de Risco Imediato (Semanas 1-2, ~13h)

| # | Item | Objetivo | Problema Resolvido | Esforço | Risco de Não Fazer | Dependências | Resultado |
|---|------|---------|-------------------|---------|-------------------|-------------|-----------|
| 1.1 | Fix `user_roles` UPDATE → developer-only | Eliminar escalonamento | P3: admin pode virar developer | Baixo (0.5h) | 🔴 Acesso total ao sistema | Nenhuma | Apenas developers podem alterar roles |
| 1.2 | Trigger `prevent_self_verification` | Eliminar auto-verificação | P4: usuário seta `creci_verified=true` | Baixo (1h) | 🔴 Fraude de identidade | Nenhuma | Campos sensíveis imutáveis pelo próprio usuário |
| 1.3 | UNIQUE em `contracts(org_id, code)` | Integridade de dados | P7: códigos duplicados | Baixo (0.5h) | 🔴 Contratos duplicados | Verificar duplicatas existentes | Unicidade garantida no banco |
| 1.4 | Auth check em `crm-import-leads` | Fechar endpoint aberto | P2: injeção de dados sem auth | Baixo (0.5h) | 🔴 Dados corrompidos | Nenhuma | Endpoint requer JWT válido |
| 1.5 | Auth check em `onesignal-app-id` | Fechar endpoint aberto | Leak de App ID | Baixo (0.5h) | 🟡 Push indesejado se REST key vazar | Nenhuma | App ID só para autenticados |
| 1.6 | Rate limit em `send-reset-email` | Bloquear bombardeio | P1: email ilimitado | Baixo (1.5h) | 🔴 Custo Resend + ban | Nenhuma | Max 3 resets/email/hora |
| 1.7 | Audit log em `admin-users` | Rastreabilidade admin | Zero log de ações destrutivas | Baixo (1h) | 🔴 Ações invisíveis | Nenhuma | DELETE/PATCH registrados em `audit_events` |
| 1.8 | Remover comparação de service key em `cleanup-orphan-media` | Eliminar vetor de ataque | Comparação direta de key | Baixo (0.5h) | 🟡 Deleção por key leak | Nenhuma | Auth via JWT ou allowlist |
| 1.9 | Validation triggers (datas, valores) | Integridade financeira | Datas incoerentes, valores negativos | Baixo (1h) | 🟡 Dados inválidos | Nenhuma | Banco rejeita dados inválidos |
| 1.10 | `isPending` guard em mutations críticas | Evitar double-click | Ações duplicadas no frontend | Baixo (2h) | 🟡 Pagamentos/leads duplicados | Nenhuma | Botões desabilitados durante mutação |
| 1.11 | Validação de URL em `og-metadata` | Prevenir SSRF | Acesso a rede interna | Baixo (1h) | 🟡 SSRF via proxy | Nenhuma | URLs internas bloqueadas |
| 1.12 | Sync `paid_at` trigger em invoices/transactions | Consistência estado/data | `status=pago` sem `paid_at` | Baixo (1h) | 🟡 Relatórios incorretos | Nenhuma | `paid_at` populado automaticamente |

### FASE 2 — Robustez Operacional e Segurança (Semanas 3-5, ~22h)

| # | Item | Objetivo | Problema Resolvido | Esforço | Risco de Não Fazer | Dependências | Resultado |
|---|------|---------|-------------------|---------|-------------------|-------------|-----------|
| 2.1 | `_shared/rate-limit.ts` genérico | Rate limiting centralizado | Sem proteção em 50+ endpoints | Médio (4h) | 🔴 Abuso em escala | Tabela `rate_limit_events` | Todas as funções protegidas |
| 2.2 | Feature gating enforcement via triggers | Proteger modelo de negócio | P5: limites só no UI | Médio (3h) | 🔴 Uso ilimitado gratuito | Tabela `subscriptions` com features | INSERT bloqueado se limite atingido |
| 2.3 | Audit triggers em leads (stage, broker) | Rastreabilidade CRM | Mudanças invisíveis | Médio (2h) | 🟡 Sem histórico comercial | Nenhuma | Mudanças registradas em `audit_events` |
| 2.4 | Audit triggers em contracts + commissions | Rastreabilidade financeira | Mudanças invisíveis | Médio (2h) | 🟡 Sem auditoria financeira | Nenhuma | Mudanças registradas automaticamente |
| 2.5 | Soft delete (`deleted_at`) em leads/contracts/properties | Recuperação de dados | P9: deleção irreversível | Médio (4h) | 🔴 Dados irrecuperáveis | Atualizar RLS + queries frontend | Restore possível |
| 2.6 | `_shared/fetch.ts` com timeout + retry | Resiliência de rede | P10: timeout indefinido | Baixo (1.5h) | 🟡 Trava fluxo do usuário | Nenhuma | Timeout 10s + 3 retries |
| 2.7 | Cloudflare Turnstile no signup/reset | Anti-bot | P8: zero CAPTCHA | Médio (4h) | 🔴 Criação massiva de contas | Secret do Turnstile | Bots bloqueados |
| 2.8 | Trigger `updated_at` automático | Cache invalidation | Staleness de cache | Baixo (1.5h) | 🟡 Dados desatualizados | Nenhuma | `updated_at` sempre preciso |

### FASE 3 — Maturidade, Prevenção e Escalabilidade (Semanas 6-10, ~22h)

| # | Item | Objetivo | Problema Resolvido | Esforço | Risco de Não Fazer | Dependências | Resultado |
|---|------|---------|-------------------|---------|-------------------|-------------|-----------|
| 3.1 | Criptografia de OAuth tokens + API keys | Segurança de integração | P6: tokens em texto plano | Alto (6h) | 🔴 Comprometimento de contas | Vault ou pgcrypto | Tokens criptografados at-rest |
| 3.2 | Validar state param nos OAuth callbacks | CSRF prevention | OAuth hijack | Médio (2h) | 🟡 Account takeover via OAuth | Nenhuma | State validado em cada callback |
| 3.3 | Bloqueio após 5 login falhos | Anti-brute force | T1: sem detecção | Médio (2h) | 🟡 Contas comprometidas | Fase 2.1 (rate limit) | Conta bloqueada 15min |
| 3.4 | Detecção de sessões simultâneas | Anti-compartilhamento | B3: login simultâneo | Médio (3h) | 🟡 Perda de receita | Nenhuma | Alerta ao admin |
| 3.5 | Verificação de telefone para trial | Anti-trial infinito | B2: múltiplas contas | Médio (3h) | 🟡 Perda de receita | Provedor de SMS | Trial vinculado a telefone |
| 3.6 | Política de retenção de logs (pg_cron) | Performance + custo | Logs crescem indefinidamente | Baixo (2h) | 🟡 DB lento e caro | pg_cron habilitado | Purge automático 90d |
| 3.7 | Jobs de consistência (cron semanal) | Qualidade de dados | Divergências não detectadas | Médio (2h) | 🟡 Dados incorretos | pg_cron | Alertas de inconsistência |
| 3.8 | Reconciliação Asaas (cron semanal) | Billing correto | Subscriptions divergentes | Médio (2h) | 🟡 Cobrança incorreta | API Asaas | Status reconciliado |

---

## BACKLOG TÉCNICO EXECUTÁVEL

```
═══════════════════════════════════════════════════════════
 FASE 1 — REDUÇÃO DE RISCO IMEDIATO (~13h, Semanas 1-2)
═══════════════════════════════════════════════════════════

Sprint 1 (Semana 1, ~7h)
─────────────────────────
[P0] 1.1  Migration: DROP + CREATE policy user_roles UPDATE .. 0.5h
[P0] 1.2  Migration: CREATE trigger prevent_self_verification  1.0h
[P0] 1.3  Migration: CREATE UNIQUE INDEX contracts(org,code) . 0.5h
[P0] 1.4  Edge Fn: auth check em crm-import-leads ........... 0.5h
[P0] 1.5  Edge Fn: auth check em onesignal-app-id ........... 0.5h
[P0] 1.6  Edge Fn: rate limit em send-reset-email ........... 1.5h
[P0] 1.7  Edge Fn: audit log em admin-users .................. 1.0h
[P0] 1.8  Edge Fn: fix cleanup-orphan-media auth ............ 0.5h

Sprint 2 (Semana 2, ~6h)
─────────────────────────
[P0] 1.9  Migration: validation triggers (datas, valores) ... 1.0h
[P1] 1.10 Frontend: isPending guard em mutations ............ 2.0h
[P1] 1.11 Edge Fn: URL validation em og-metadata ............ 1.0h
[P1] 1.12 Migration: sync paid_at trigger ................... 1.0h
[P1]      Migration: updated_at trigger automático .......... 1.0h

═══════════════════════════════════════════════════════════
 FASE 2 — ROBUSTEZ E SEGURANÇA (~22h, Semanas 3-5)
═══════════════════════════════════════════════════════════

Sprint 3 (Semana 3, ~8h)
─────────────────────────
[P1] 2.1  _shared/rate-limit.ts + tabela + integração ....... 4.0h
[P1] 2.2  Feature gating triggers no banco .................. 3.0h
[P1] 2.8  updated_at trigger (tabelas restantes) ............ 1.0h

Sprint 4 (Semana 4, ~8h)
─────────────────────────
[P1] 2.3  Audit triggers: leads ............................. 2.0h
[P1] 2.4  Audit triggers: contracts + commissions ........... 2.0h
[P1] 2.5  Soft delete: deleted_at + RLS + frontend .......... 4.0h

Sprint 5 (Semana 5, ~6h)
─────────────────────────
[P1] 2.6  _shared/fetch.ts (timeout + retry) ................ 1.5h
[P1] 2.7  Cloudflare Turnstile: signup + reset .............. 4.0h
[P2]      Depreciar leads.stage → lead_stage_id ............. 0.5h

═══════════════════════════════════════════════════════════
 FASE 3 — MATURIDADE E PREVENÇÃO (~22h, Semanas 6-10)
═══════════════════════════════════════════════════════════

Sprint 6 (Semana 6-7, ~8h)
──────────────────────────
[P2] 3.1  Encrypt OAuth tokens + API keys ................... 6.0h
[P2] 3.2  State param validation nos OAuth callbacks ........ 2.0h

Sprint 7 (Semana 8-9, ~8h)
──────────────────────────
[P2] 3.3  Bloqueio login falho .............................. 2.0h
[P2] 3.4  Detecção sessões simultâneas ...................... 3.0h
[P2] 3.5  Verificação de telefone para trial ................ 3.0h

Sprint 8 (Semana 10, ~6h)
─────────────────────────
[P3] 3.6  Política de retenção de logs ...................... 2.0h
[P3] 3.7  Jobs de consistência de dados ..................... 2.0h
[P3] 3.8  Reconciliação Asaas ............................... 2.0h

═══════════════════════════════════════════════════════════
 TOTAIS
═══════════════════════════════════════════════════════════

Fase 1: ~13h (2 sprints)  → Reduz 70% dos riscos críticos
Fase 2: ~22h (3 sprints)  → Sistema robusto e auditável
Fase 3: ~22h (3 sprints)  → Maturidade operacional

Total:  ~57h em 10 semanas
```

---

## MÉTRICAS DE SUCESSO POR FASE

| Fase | Métrica | Meta |
|------|---------|------|
| **1** | Endpoints sem auth | 0 (de 3 atuais) |
| **1** | Riscos P0 abertos | 0 (de 8 atuais) |
| **2** | Tabelas com audit trail automático | 5+ (de 1 atual) |
| **2** | Edge Functions com rate limit | 100% (de ~15% atual) |
| **3** | Tokens criptografados | 100% (de 0% atual) |
| **3** | Taxa de contas fantasma | <10% |

---

*Plano consolidado a partir de 5 auditorias técnicas realizadas em 2026-03-23.*
