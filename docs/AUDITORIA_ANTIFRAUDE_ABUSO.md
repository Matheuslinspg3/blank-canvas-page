# Auditoria Antifraude e Prevenção de Abuso — Porta do Corretor
**Data:** 2026-03-23

---

## 1. Mapa de Superfícies Vulneráveis

### 1.1 Endpoints Sem Autenticação (`verify_jwt=false` + sem auth interna)

| # | Função | Risco | Abuso Possível |
|---|--------|-------|---------------|
| **A1** | `send-reset-email` | 🔴 Crítico | Bombardeio de emails (custo Resend), enumeração de contas, spam |
| **A2** | `onesignal-app-id` | 🟡 Médio | Expõe App ID — permite envio de push se REST key vazar |
| **A3** | `meta-app-id` | 🟡 Médio | Expõe Meta App ID público — risco baixo sozinho |
| **A4** | `rd-station-app-id` | 🟡 Médio | Expõe RD Station App ID |
| **A5** | `platform-signup` | 🟡 Médio | Criação de orgs via convite — mitigado por invite validation, mas sem rate limit |
| **A6** | `rd-station-webhook` | 🟡 Médio | Webhook externo — aceita dados sem assinatura de webhook |
| **A7** | `og-metadata` | 🟢 Baixo | Proxy de metadados OG — pode ser usado para SSRF se não validar URLs |
| **A8** | `crm-import-leads` | 🔴 Crítico | Sem auth + service role — pode injetar leads em qualquer org |

### 1.2 Formulários e Fluxos Públicos

| Superfície | Proteção Atual | Risco |
|-----------|---------------|-------|
| Cadastro (`Auth.tsx`) | Validação Zod client-side, Supabase Auth | ⚠️ Sem CAPTCHA, sem rate limit |
| Login | Supabase Auth padrão | ⚠️ Sem rate limit, sem detecção de brute force |
| Reset de senha | `send-reset-email` sem auth | 🔴 Sem rate limit, sem CAPTCHA |
| App Auth (consumidor) | `AppAuth.tsx` — email+senha simples | ⚠️ Sem CAPTCHA |
| Marketplace (busca) | Público via view | 🟢 Baixo (dados já filtrados) |
| Convite de plataforma | `platform-signup` + invite ID | 🟡 Rate limit ausente |

### 1.3 APIs Autenticadas Vulneráveis a Abuso

| API | Risco | Detalhe |
|-----|-------|---------|
| `r2-presign` | 🟡 Upload abusivo | Valida MIME types mas sem limite de uploads/dia por usuário |
| `r2-upload` | 🟡 Upload abusivo | Sem limite de tamanho total por org |
| `generate-ad-content` | ✅ Rate limited | 20 req/h via `checkAiRateLimit` |
| `generate-ad-image` | ✅ Rate limited | 20 req/h |
| `ai-router` | ✅ Rate limited | 20 req/h + multi-provider failover |
| `admin-users` (DELETE) | 🟡 Destrutivo | Autenticado + developer, mas sem confirmação ou cool-down |

---

## 2. Cenários de Abuso Técnico e de Negócio

### 2.1 Abuso Técnico

| # | Cenário | Probabilidade | Impacto | Defesa Atual |
|---|---------|--------------|---------|-------------|
| **T1** | Brute force no login | Alta | 🔴 Acesso indevido | ❌ Nenhuma (Supabase tem rate limit leve, ~30 req/s) |
| **T2** | Bombardeio de `send-reset-email` | Alta | 🔴 Custo Resend + spam | ❌ Nenhuma |
| **T3** | Criação massiva de contas via signup | Média | 🟡 Orgs fantasma, custo DB | ❌ Sem CAPTCHA |
| **T4** | Scraping do marketplace | Média | 🟡 Extração de dados imobiliários | ⚠️ RLS filtra PII |
| **T5** | Upload massivo de arquivos via R2 | Média | 🟡 Custo de storage | ⚠️ Valida MIME, sem limite total |
| **T6** | Injeção de leads via `crm-import-leads` | Alta | 🔴 Dados corrompidos | ❌ Sem auth |
| **T7** | Abuso de IA (gerar conteúdo em massa) | Média | 🟡 Custo de API | ✅ Rate limit 20/h |
| **T8** | Enumeração de emails via reset | Média | 🟡 Privacy leak | ✅ Retorna 200 mesmo para emails inexistentes |
| **T9** | SSRF via `og-metadata` | Baixa | 🟡 Acesso a rede interna | ⚠️ Depende de validação de URL |
| **T10** | DoS via Edge Functions pesadas (vídeo, arte) | Baixa | 🟡 Exaustão de resources | ✅ Rate limit + auth |

### 2.2 Abuso de Negócio

| # | Cenário | Probabilidade | Impacto | Defesa Atual |
|---|---------|--------------|---------|-------------|
| **B1** | Trial infinito — criar nova conta com mesmo email | Baixa | 🟡 Perda de receita | ✅ Supabase não permite email duplicado |
| **B2** | Trial infinito — criar nova conta com email diferente | Alta | 🔴 Perda de receita | ❌ Sem device fingerprint, sem verificação de telefone |
| **B3** | Compartilhamento de conta (login simultâneo) | Alta | 🟡 Perda de receita | ❌ Sem detecção de sessões simultâneas |
| **B4** | Corretor acessa dados de leads após sair da org | Média | 🟡 Vazamento de dados | ✅ RLS por org_id no profile |
| **B5** | Admin convida e remove membros para inflar plan limits | Baixa | 🟡 Abuso de limites | ⚠️ Feature gating é UI-only |
| **B6** | Uso da IA para gerar anúncios para terceiros (revenda) | Média | 🟡 Perda de valor | ⚠️ Rate limit existe mas pode ser contornado com múltiplas contas |
| **B7** | Exportação massiva de dados (CSV) e migração para concorrente | Média | 🟡 Churn com dados | ✅ Export protegido por `admin_allowlist` |
| **B8** | Manipulação de `lead.score` ou `temperature` para priorização indevida | Baixa | 🟢 Impacto interno | ⚠️ Editável por qualquer membro da org |
| **B9** | Feature gating bypass — limites apenas no UI | Alta | 🔴 Uso ilimitado sem pagar | ❌ `useSubscription` helpers não enforcados no banco |

---

## 3. Defesas Imediatas e de Médio Prazo

### 3.1 Defesas Imediatas (Semana 1-2, ~12h)

| # | Defesa | Esforço | Protege Contra |
|---|--------|---------|---------------|
| **D1** | Rate limit no `send-reset-email` (1 por email/min, 5/h por IP) | 2h | T2, A1 |
| **D2** | Auth check no `crm-import-leads` e `onesignal-app-id` | 1h | T6, A2, A8 |
| **D3** | Rate limit no signup (Supabase Auth config ou Edge Function wrapper) | 2h | T3, B2 |
| **D4** | Limite de uploads/dia por org no `r2-presign` | 1.5h | T5 |
| **D5** | Feature gating enforcement no banco (RLS ou triggers) | 3h | B9 |
| **D6** | Audit log em `admin-users` DELETE/PATCH | 1h | Rastreabilidade |
| **D7** | Validação de URL no `og-metadata` (bloquear IPs internos) | 1h | T9 |

### 3.2 Defesas de Médio Prazo (Semana 3-6, ~20h)

| # | Defesa | Esforço | Protege Contra |
|---|--------|---------|---------------|
| **D8** | Cloudflare Turnstile (CAPTCHA invisível) no signup e login | 4h | T1, T3, B2 |
| **D9** | Rate limiting genérico para todas as Edge Functions (_shared/rate-limit.ts) | 3h | Todos os T* |
| **D10** | Detecção de sessões simultâneas + alerta ao admin | 3h | B3 |
| **D11** | Webhook signature validation para RD Station | 2h | A6 |
| **D12** | Bloqueio de conta após N tentativas de login falho | 2h | T1 |
| **D13** | Verificação de telefone obrigatória para ativar trial | 3h | B2 |
| **D14** | Soft-ban: conta em "revisão" com acesso read-only | 3h | Resposta a abuso |

---

## 4. Rate Limiting, Detecção, Revisão e Resposta

### 4.1 Arquitetura de Rate Limiting Proposta

```
┌─────────────────────────────────────────────────────┐
│                Edge Function Request                 │
├─────────────────────────────────────────────────────┤
│  Camada 1: Cloudflare (WAF/Rate Limit por IP)       │ ← Já disponível via DNS
│  Camada 2: _shared/rate-limit.ts (por user + fn)    │ ← NOVO
│  Camada 3: checkAiRateLimit (IA específico)         │ ← Existente (20/h)
│  Camada 4: RLS + Triggers (enforcement final)       │ ← Parcial
└─────────────────────────────────────────────────────┘
```

#### `_shared/rate-limit.ts` — Proposta

```typescript
// Tabela: rate_limit_events (user_id, action, ip, created_at)
// Ou usar pg advisory locks para performance

interface RateLimitConfig {
  action: string;           // ex: "signup", "reset", "upload"
  maxRequests: number;       // ex: 5
  windowMs: number;          // ex: 3600000 (1h)
  keyType: "user" | "ip" | "email" | "user+ip";
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "send-reset-email": { action: "reset", maxRequests: 3, windowMs: 3600_000, keyType: "email" },
  "signup":           { action: "signup", maxRequests: 5, windowMs: 3600_000, keyType: "ip" },
  "r2-presign":       { action: "upload", maxRequests: 100, windowMs: 86400_000, keyType: "user" },
  "admin-users":      { action: "admin", maxRequests: 10, windowMs: 3600_000, keyType: "user" },
};
```

### 4.2 Detecção de Comportamento Suspeito

| Sinal | Detecção | Resposta |
|-------|---------|---------|
| >5 logins falhos em 10min | Query `auth.audit_log_entries` (se disponível) ou Edge Function wrapper | Bloquear por 15min + notificar admin |
| >3 contas criadas do mesmo IP em 1h | Tabela `signup_events` com IP | CAPTCHA obrigatório |
| Upload de >50 imagens em 5min | Count em `property_media` | Throttle para 1/10s |
| >10 resets de senha em 1h (qualquer email) | Count em `audit_events` por IP | Bloquear IP por 1h |
| Acesso a >100 leads em 1min (scraping) | Query logs de RLS | Rate limit na API |
| Login de IP diferente do habitual | Comparar com últimos 5 IPs | Pedir re-autenticação |

### 4.3 Resposta Gradual ao Abuso

```
Nível 0: Comportamento normal
  → Nenhuma ação

Nível 1: Suspeita leve (ex: muitos resets)
  → Rate limit + CAPTCHA

Nível 2: Suspeita moderada (ex: brute force)
  → Bloquear ação por 15min
  → Notificar admin por email/push

Nível 3: Abuso confirmado (ex: criação massiva de contas)
  → Suspender conta temporariamente
  → Registrar evidência em audit_events
  → Notificar equipe

Nível 4: Abuso grave (ex: injeção de dados, SSRF)
  → Banir conta permanentemente
  → Revogar todas as sessões
  → Preservar evidências para análise
```

---

## 5. Recomendações para Reduzir Fraude sem Punir Usuário Legítimo

### 5.1 Princípios

| Princípio | Implementação |
|-----------|--------------|
| **Fricção progressiva** | Começar sem CAPTCHA → exigir CAPTCHA só após comportamento anômalo |
| **Punir a ação, não o ator** | Rate limit por endpoint, não banimento imediato |
| **Transparência** | Mensagens claras: "Muitas tentativas. Aguarde 5 minutos." |
| **Recuperação** | Permitir contestação via email/suporte antes de banimento permanente |
| **Exceções para power users** | Whitelisting de orgs confiáveis com limites maiores |
| **Cache defensivo** | Preservar dados do formulário em caso de rate limit |

### 5.2 UX durante Bloqueio

| Cenário | UX Atual | UX Recomendada |
|---------|---------|---------------|
| Rate limit de IA | ✅ "Limite de 20 requisições/hora excedido" | OK — Adicionar countdown |
| Rate limit de upload | ❌ Não existe | "Limite diário de uploads atingido. Seu plano permite X uploads/dia." |
| Brute force no login | ❌ Sem feedback específico | "Conta temporariamente bloqueada. Tente novamente em 15 minutos ou use 'Esqueci minha senha'." |
| Trial expirado | ✅ Tela de upgrade | OK |
| Conta suspensa | ❌ Não existe | Tela dedicada: "Sua conta está em revisão. Entre em contato com suporte." |

---

## 6. Backlog Técnico e Operacional Priorizado

```
FASE 1 — DEFESAS CRÍTICAS (Semana 1-2, ~12h)
[ ] D1   Rate limit no send-reset-email ..................... 2h [P0]
[ ] D2   Auth check em crm-import-leads e onesignal-app-id .. 1h [P0]
[ ] D6   Audit log em admin-users DELETE/PATCH .............. 1h [P0]
[ ] D5   Feature gating enforcement: trigger que conta
         registros antes de INSERT em leads/properties ...... 3h [P0]
[ ] D7   Validação de URL no og-metadata .................... 1h [P1]
[ ] D3   Rate limit no signup (3/h por IP) .................. 2h [P1]
[ ] D4   Limite de uploads/dia por org ...................... 1.5h [P1]

FASE 2 — CAMADA DE RATE LIMITING (Semana 3-4, ~8h)
[ ] D9   _shared/rate-limit.ts genérico ..................... 3h [P1]
[ ]      Tabela rate_limit_events ........................... 1h [P1]
[ ]      Integrar rate limit em 10+ Edge Functions .......... 2h [P1]
[ ] D11  Webhook signature validation (RD Station) .......... 2h [P1]

FASE 3 — CAPTCHA E DETECÇÃO (Semana 5-6, ~10h)
[ ] D8   Cloudflare Turnstile no signup e login ............. 4h [P2]
[ ] D12  Bloqueio após N login falhos ....................... 2h [P2]
[ ] D10  Detecção de sessões simultâneas .................... 3h [P2]
[ ]      Dashboard de abuso para developers ................. 1h [P3]

FASE 4 — PREVENÇÃO DE NEGÓCIO (Semana 7-8, ~8h)
[ ] D13  Verificação de telefone para trial ................. 3h [P2]
[ ] D14  Sistema de soft-ban (conta em revisão) ............. 3h [P3]
[ ]      Alertas automáticos de comportamento anômalo ........ 2h [P3]

TOTAL: ~38h em 8 semanas
```

---

## 7. Plano de Evolução Antifraude

### Fase 1 — Fundação (Mês 1)
- Rate limiting em todas as Edge Functions
- Auth check em endpoints expostos
- Audit trail completo para ações admin
- Feature gating enforced no banco

### Fase 2 — Detecção (Mês 2)
- Cloudflare Turnstile em fluxos públicos
- Detecção de padrões anômalos (brute force, scraping)
- Dashboard de eventos de segurança para developers
- Webhook signature validation

### Fase 3 — Resposta (Mês 3)
- Sistema de soft-ban com UX dedicada
- Alertas automáticos para equipe
- Runbook de investigação de abuso
- Verificação de telefone como gating

### Fase 4 — Maturidade (Trimestre 2+)
- Métricas de false positive rate
- Thresholds adaptativos baseados em histórico
- Revisão trimestral de regras antifraude
- Playbook de resposta a incidentes

### KPIs Antifraude

| Métrica | Como Medir | Meta |
|---------|-----------|------|
| Taxa de contas fantasma | Orgs sem atividade após 7d / Total signup | <10% |
| Taxa de brute force bloqueado | Login falhos bloqueados / Total tentativas | >95% |
| Custo de abuso de IA | Chamadas rate-limited / Total chamadas IA | <5% |
| False positive rate | Contestações aceitas / Total suspensões | <5% |
| Tempo de detecção | Média entre primeiro sinal e ação | <1h |

---

## 8. Resumo Executivo

### ✅ O que já está BOM
- **Rate limiting de IA** — `checkAiRateLimit` em 8+ Edge Functions (20 req/h)
- **RLS em 100% das tabelas** — isolamento multi-tenant forte
- **`send-reset-email` não revela se email existe** — anti-enumeração
- **`platform-signup` valida invite + email binding** — anti-signup fraudulento
- **`r2-presign` valida MIME types** — anti-upload malicioso
- **Audit trigger em `user_roles`** — rastreabilidade de mudanças de permissão
- **`admin_allowlist` para ações admin globais** — acesso controlado

### ❌ O que PRECISA de atenção
- **`send-reset-email` sem rate limit** — superfície #1 de abuso
- **`crm-import-leads` sem autenticação** — injeção de dados trivial
- **Zero CAPTCHA em todo o sistema** — bots podem criar contas livremente
- **Feature gating apenas no UI** — plano gratuito pode consumir como Business
- **Nenhuma detecção de brute force** — login pode ser forçado sem penalidade
- **Sem rate limit genérico** — apenas IA tem proteção, outros endpoints estão expostos
- **Trial infinito via múltiplas contas** — sem verificação de telefone ou device

### Princípio guia
> **"Defender em camadas: IP → Rate Limit → Auth → Role → RLS → Audit."**
> Cada camada pega o que a anterior deixou passar. Nenhuma camada sozinha é suficiente.
> O custo de abusar deve ser sempre maior que o benefício obtido.

---

*Auditoria gerada por análise de Edge Functions, RLS policies, Auth context, e fluxos de negócio em 2026-03-23.*
