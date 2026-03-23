# Auditoria de Feature Flags e Rollout — Porta do Corretor

**Data:** 2026-03-23  
**Status atual:** Nenhuma infraestrutura de feature flags existe no app.

---

## 1. MODELO IDEAL DE FLAGS PARA O APP

### Tipos de Flag Recomendados

| Tipo | Exemplo | Persistência | Avaliação |
|------|---------|-------------|-----------|
| **Release** | `new_kanban_v2` | Até remoção após rollout 100% | Frontend + Backend |
| **Kill Switch** | `ks_imobzi_sync` | Permanente | Backend (Edge Fn) |
| **Operacional** | `op_ai_generation` | Permanente | Backend |
| **Permissão/Plano** | `plan_video_generation` | Permanente | Frontend (derivada de subscription) |
| **Migração** | `mig_r2_upload_flow` | Até migração completa | Backend |
| **Experimento** | `exp_cta_landing_page` | Duração do teste | Frontend |

### Schema Proposto: `feature_flags`

```sql
create table public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,           -- ex: 'new_kanban_v2'
  flag_type text not null default 'release',  -- release|kill_switch|operational|experiment|migration
  description text,
  enabled boolean not null default false,     -- kill switch global
  rollout_percentage int default 0 check (rollout_percentage between 0 and 100),
  allowed_roles text[] default '{}',          -- ex: {'developer','admin'}
  allowed_org_ids uuid[] default '{}',        -- tenants específicos
  metadata jsonb default '{}',                -- dados extras (variantes de experimento, etc)
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  expires_at timestamptz                      -- auto-limpeza de flags temporárias
);

alter table public.feature_flags enable row level security;

-- Leitura aberta para autenticados (flags são configurações, não dados sensíveis)
create policy "Authenticated can read flags"
  on public.feature_flags for select to authenticated
  using (true);

-- Somente developers podem modificar
create policy "Developers manage flags"
  on public.feature_flags for all to authenticated
  using (public.has_role(auth.uid(), 'developer'))
  with check (public.has_role(auth.uid(), 'developer'));
```

### Hook: `useFeatureFlag`

```tsx
// src/hooks/useFeatureFlag.ts
function useFeatureFlag(key: string): boolean {
  // 1. Query feature_flags table (cached 5min via React Query)
  // 2. Check enabled === true
  // 3. Check rollout_percentage (hash user_id para decisão determinística)
  // 4. Check allowed_roles (se não vazio, role do user deve constar)
  // 5. Check allowed_org_ids (se não vazio, org do user deve constar)
  // 6. Return boolean
}
```

### Avaliação Determinística

Para rollout percentual consistente (mesmo user sempre vê a mesma variante):
```ts
function isInRollout(userId: string, flagKey: string, percentage: number): boolean {
  const hash = simpleHash(`${userId}:${flagKey}`) % 100;
  return hash < percentage;
}
```

---

## 2. RISCOS ATUAIS DE ROLLOUT E REVERSÃO

### R1: Deploys são tudo-ou-nada
- **Risco:** Qualquer mudança vai para 100% dos usuários imediatamente. Se a mudança quebra algo, o rollback exige um novo deploy.
- **Impacto:** Downtime visível para todos. Não há como proteger parcialmente.
- **Severidade:** 🔴 Alta

### R2: Kill switches inexistentes
- **Risco:** Se a integração Imobzi, o upload R2, ou a geração de IA falhar em massa, não há como desabilitar a feature sem deploy. O `maintenance_mode` é binário (app inteiro ou nada).
- **Impacto:** Degradação cascata. Todos os fluxos dependentes param.
- **Severidade:** 🔴 Alta

### R3: Sem separação entre usuários internos e externos
- **Risco:** Não há como testar uma feature em produção com apenas a equipe interna antes de liberar para clientes.
- **Impacto:** Bugs chegam ao cliente final. Não há alpha/beta testing.
- **Severidade:** 🟡 Média

### R4: Mudanças de schema sem flag de migração
- **Risco:** Alterações de banco (novas colunas, novos fluxos) entram em produção junto com o código. Se o código tem bug, a migração já foi aplicada.
- **Impacto:** Rollback parcial impossível.
- **Severidade:** 🟡 Média

### R5: Edge Functions sem circuit breaker
- **Risco:** Se uma Edge Function começa a falhar (ex: API externa indisponível), ela continua sendo chamada sem controle.
- **Impacto:** Erros em cascata, rate limit da API, timeout para o usuário.
- **Severidade:** 🟡 Média

---

## 3. PROPOSTA DE GOVERNANÇA MÍNIMA

### Quem pode o quê

| Ação | Developer | Admin | Operador |
|------|-----------|-------|----------|
| Criar flag | ✅ | ❌ | ❌ |
| Ativar para internos (≤ 5%) | ✅ | ❌ | ❌ |
| Ampliar rollout (> 5%) | ✅ | ❌ | ❌ |
| Ativar kill switch (desligar feature) | ✅ | ✅ | ❌ |
| Desativar kill switch | ✅ | ❌ | ❌ |
| Remover flag | ✅ | ❌ | ❌ |

### Nomenclatura Padronizada

```
{tipo}_{módulo}_{feature}
```

Exemplos:
- `rel_crm_kanban_v2` — Release: novo Kanban
- `ks_integrations_imobzi` — Kill switch: sync Imobzi
- `op_ai_text_generation` — Operacional: geração de texto IA
- `exp_landing_cta_variant` — Experimento: variante de CTA
- `mig_media_r2_migration` — Migração: upload via R2

### Ciclo de Vida

```
1. Criação → flag com enabled=false, rollout=0%
2. Teste interno → allowed_roles=['developer'], enabled=true
3. Alpha → allowed_org_ids=[org_piloto], rollout=100%
4. Rollout gradual → rollout 10% → 25% → 50% → 100%
5. Estabilização → 2 semanas sem incidente
6. Remoção → remover condicionais do código
7. Exclusão → deletar row da tabela
```

### Documentação Mínima por Flag

O campo `description` deve conter:
- O que a flag controla
- Quem é o owner
- Data prevista de remoção (para releases)
- Link para issue/ticket relacionado

---

## 4. CONSISTÊNCIA FRONTEND × BACKEND

### Princípio: Flag avaliada uma vez, respeitada em ambos

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  useFeatureFlag  │──→│  UI condicional │     │  Edge Function │
│  (React Query)   │     │  {flag && <X/>}  │     │  checks flag   │
└─────────────┘     └──────────────┘     └──────────────┘
        │                                           │
        └───── mesma tabela feature_flags ──────────┘
```

### Regras de Coerência

1. **Se UI esconde, endpoint também deve negar** — Edge Function deve validar a flag antes de executar. UI esconder um botão não basta.
2. **Flag avaliada no client usa cache de 5min** — Mudança de flag leva até 5min para propagar. Para kill switches críticos, usar Realtime subscription.
3. **Kill switches no backend são imediatos** — Edge Functions leem a flag a cada request (sem cache).
4. **Analytics marcam variante** — Todo evento de tracking deve incluir as flags ativas do usuário.

### Implementação no Backend (Edge Functions)

```ts
// Em Edge Functions que precisam respeitar flags:
const { data: flag } = await supabase
  .from('feature_flags')
  .select('enabled, rollout_percentage')
  .eq('key', 'ks_integrations_imobzi')
  .single();

if (!flag?.enabled) {
  return new Response(JSON.stringify({ error: 'Feature disabled' }), { status: 503 });
}
```

---

## 5. ESTRATÉGIA DE ROLLOUT POR TIPO DE MUDANÇA

| Tipo de Mudança | Estratégia | Flag | Critério de Avanço |
|----------------|-----------|------|-------------------|
| **Nova feature UI** | Interno → Beta org → 10% → 50% → 100% | `rel_*` | Zero erros JS, feedback positivo |
| **Refactor de fluxo existente** | Interno → 5% → 25% → 100% | `rel_*` | Métricas iguais ao fluxo antigo |
| **Nova integração** | Kill switch ativo + interno primeiro | `ks_*` | Taxa de sucesso > 95% |
| **Migração de dados** | Flag de migração + dual-write | `mig_*` | Dados consistentes em ambos schemas |
| **Experimento A/B** | 50/50 randomizado | `exp_*` | Significância estatística |
| **Mudança operacional** | Admin liga/desliga | `op_*` | Critério de negócio |

---

## 6. BACKLOG TÉCNICO PRIORIZADO

### Sprint 1 — Fundação (~6h) 🔴
| # | Item | Esforço |
|---|------|---------|
| 1 | Criar tabela `feature_flags` + RLS | 1h |
| 2 | Criar hook `useFeatureFlag` com cache + hash determinístico | 2h |
| 3 | Criar UI de gestão de flags no Developer Dashboard (nova tab) | 3h |

### Sprint 2 — Kill Switches (~4h) 🔴
| # | Item | Esforço |
|---|------|---------|
| 4 | Implementar kill switch para Imobzi sync (`ks_integrations_imobzi`) | 1h |
| 5 | Kill switch para geração IA (`ks_ai_generation`) | 1h |
| 6 | Kill switch para upload R2 (`ks_media_r2_upload`) | 1h |
| 7 | Realtime subscription para kill switches (propagação imediata) | 1h |

### Sprint 3 — Rollout Gradual (~4h) 🟡
| # | Item | Esforço |
|---|------|---------|
| 8 | Rollout percentual com hash determinístico no hook | 1h |
| 9 | Filtro por org_id e role no hook | 1h |
| 10 | Indicador visual de flag ativa no header (modo dev) | 1h |
| 11 | Audit log para mudanças de flag | 1h |

### Sprint 4 — Higiene e Observabilidade (~4h) 🟡
| # | Item | Esforço |
|---|------|---------|
| 12 | Campo `expires_at` + alerta de flags expiradas na UI | 1h |
| 13 | Helper para Edge Functions checarem flags | 1h |
| 14 | Dashboard de flags ativas com status de rollout | 2h |

---

## 7. PLANO PARA EVITAR ACÚMULO E DÍVIDA DE FLAGS

### Regras Anti-Acúmulo

1. **Toda flag de release tem `expires_at`** — Máximo 30 dias após rollout 100%.
2. **Alerta semanal de flags expiradas** — Card no Developer Dashboard: "3 flags passaram da data de remoção".
3. **Limite de flags ativas** — Máximo 15 flags simultâneas. Acima disso, forçar remoção antes de criar nova.
4. **Kill switches são permanentes** — Não expiram. São infraestrutura.
5. **Remoção = 2 passos** — (1) Remover condicionais do código, (2) Deletar flag da tabela. Ambos devem acontecer no mesmo sprint.

### Checklist de Remoção
- [ ] Flag está em 100% há > 2 semanas sem incidente
- [ ] Código alternativo (path antigo) foi removido
- [ ] Testes foram atualizados para não depender da flag
- [ ] Row deletada da tabela `feature_flags`
- [ ] Audit log registra a remoção

### Métricas de Saúde
| Métrica | Alvo |
|---------|------|
| Flags ativas | ≤ 15 |
| Flags expiradas sem remoção | 0 |
| Tempo médio de vida de flag release | ≤ 45 dias |
| Kill switches sem uso em 90 dias | Revisar necessidade |

---

## DIAGNÓSTICO GERAL

O app opera em modo **"deploy = rollout total"** — sem nenhuma capacidade de lançamento gradual, kill switch, ou experimentação. O único mecanismo de controle é o `maintenance_mode` (binário: tudo ligado ou tudo desligado). Isso significa que qualquer bug em produção afeta 100% dos usuários imediatamente, e a reversão exige um novo deploy.

A infraestrutura proposta (1 tabela + 1 hook + UI de gestão) é leve, não depende de serviço externo, e resolve os 5 riscos identificados. O investimento total é ~18h distribuído em 4 sprints.

**Recomendação imediata:** Sprint 1 (tabela + hook + UI) — ~6h. Estabelece a fundação que todos os sprints seguintes precisam.
