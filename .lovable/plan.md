

# Diagnóstico Técnico — Base para Feature de ITBI por Município
**Escopo:** ITBI como dado complementar dentro do Simulador do Correspondente Bancário, com regras versionadas por município (5.570 cidades), nível de confiança e fallback estadual.

---

## 1. Estrutura atual do sistema

**Stack**
- **Frontend:** React 18 + Vite 5 + TypeScript 5, Tailwind v3 + shadcn/ui, Radix, Recharts, React Query, React Router. Zod nos formulários.
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions Deno). N8N orquestrador externo. OpenClaw VPS para tarefas longas.
- **Storage:** Supabase (privado/RLS) + Cloudflare R2 (mídia + pHash) + Cloudinary (logos/site).
- **Cache/Rate-limit:** Upstash Redis (30 req/h IA).

**Organização do projeto**
```text
src/
├── pages/           # Rotas (CorrespondenteBancario.tsx, etc)
├── components/
│   └── financing/   # Módulo Correspondente Bancário (UI)
│       └── utils/simulationCalc.ts   # Núcleo de cálculo SAC/PRICE
├── hooks/
│   └── financing/   # useBankRates, useSelicRate
├── constants/
│   ├── bancos-financiamento.ts       # ITBI_RATES por UF (estático!)
│   └── tabela-mip.ts                 # Alíquotas seguro
└── integrations/supabase/            # Cliente + tipos auto-gerados
supabase/
├── functions/       # Edge Functions (Deno) — há uma chamada `financing`
└── migrations/      # Schema versionado
```

**Auth & Multi-tenant**
- Supabase Auth (JWT). Tudo isolado por `organization_id` via RLS.
- Roles em tabela separada (`user_roles`) com `has_role()`, `is_org_admin()`.
- Edge Functions usam `auth.getUser()` (nunca `getClaims`).

**Comunicação FE↔BE**
- Cliente Supabase tipado para CRUD direto com RLS.
- React Query (`useQuery`/`useMutation`) + invalidações pontuais.
- Edge Functions para lógica que precisa de service role / integrações externas.

---

## 2. Módulo Correspondente Bancário

**Localização:** `src/pages/CorrespondenteBancario.tsx` → `src/components/financing/CorrespondenteTab.tsx` (sidebar com 6 seções: dashboard, pipeline, **simulador**, rentabilidade, formulários, documentação).

**Simulador (`FinancingSimulator.tsx`)** — núcleo da feature
- Inputs: valor imóvel, % entrada, prazo, sistema (SAC/PRICE), renda, idade, FGTS, **estado (UF)**.
- Hooks externos: `useTaxaReferencial` (TR do BCB), `useSelicRate`.
- Cálculo: `utils/simulationCalc.ts → simularTodosBancos()` itera 6 bancos hardcoded em `BANCOS_FINANCIAMENTO`, gera amortização mês a mês, MIP, DFI, CET por busca binária.
- Resultado: `BankComparisonView`, `EvolutionChart`, `SimulationResults` (este último já tem aba **"Custos"** que exibe ITBI + escritura + registro + avaliação).
- **ITBI hoje:** `ITBI_RATES: Record<UF, number>` em `constants/bancos-financiamento.ts` — 27 UFs, taxa única estadual, sem município, sem versionamento, sem confiança.

**Persistência**
- `simulacoes_financiamento` (tabela existente): salva snapshot completo da simulação (valores, parcelas, CET, comprometimento). Vinculada a `lead_id`, `imovel_id`, `corretor_id`, `organization_id`. **Não tem coluna ITBI ainda.**
- `financing_bank_rates`: taxas por org (override do hardcoded).

---

## 3. Modelos de dados relevantes

| Tabela | Uso | Campos-chave |
|---|---|---|
| `organizations` | tenant | id, slug, type |
| `profiles` / `user_roles` | usuários + RBAC | user_id, organization_id, role |
| `leads` | CRM | id, broker_id, lead_stage_id |
| `properties` | imóveis | sale_price, address_state, **address_city**, address_neighborhood |
| `simulacoes_financiamento` | snapshots | valor_imovel, banco_id, prazo, parcelas, CET, **(sem ITBI)** |
| `financing_bank_rates` | overrides | bank_code, rate_min/max, max_ltv |

**Localização nas tabelas existentes:** `properties.address_city/state` (texto livre, sem FK, sem código IBGE). **Não há tabela de municípios/IBGE.** Será necessária.

---

## 4. Fluxo atual da simulação

1. Usuário entra em `/correspondente-bancario` → aba "Simulador".
2. Ajusta sliders (valor, entrada, prazo) + inputs (renda, idade, FGTS) + **Select de UF** (drives ITBI).
3. `useMemo` recalcula `simularTodosBancos()` em tempo real (client-side).
4. Resultado renderizado em 3 blocos: comparativo de bancos, gráfico de evolução, detalhamento (com aba Custos exibindo ITBI = `valorImovel × ITBI_RATES[UF] / 100`).
5. Persistência manual via `simulacoes_financiamento` (não automática a cada slider).

---

## 5. Padrões de desenvolvimento

- **Tabelas:** sempre com `organization_id`, RLS via `get_user_organization_id()`, security definer functions para evitar recursão; `is_default` para registros seed protegidos.
- **Hooks:** React Query (`use<Domain><Op>`); mutations invalidam queries específicas.
- **Lógica pura:** isolada em `utils/` (caso de `simulationCalc.ts`).
- **Constantes:** seed em `src/constants/` quando estáticas; tabela quando precisam ser editáveis por org.
- **UI:** shadcn/ui, dark theme Graphite Navy, sem cores frias frívolas, badges para status.
- **Integrações externas:** Edge Functions com `X-Webhook-Secret` quando vindas de N8N; `auth.getUser()` para contexto de usuário.

---

## 6. Pontos de extensão ideais

- **Substituir** `ITBI_RATES` (UF) por **resolver dinâmico** consultando tabela de municípios → fallback UF → fallback nacional (3%).
- **Acoplar** novo hook `useItbiRule(cityIbge?, uf, propertyValue, transactionType)` ao `FinancingSimulator.tsx` (linha onde hoje calcula `itbiValue`).
- **Reaproveitar** aba "Custos" de `SimulationResults.tsx` — apenas enriquecer com badge de confiança + fonte da regra.
- **Persistir** ITBI no snapshot (`simulacoes_financiamento`) para auditoria histórica (regra pode mudar; congelar a versão usada).
- **Geocoder existente** (`geocode-properties` Edge Function) já resolve cidades → reutilizar para preencher código IBGE em `properties`.

---

## 7. Limitações e riscos

- **Sem tabela IBGE:** cidade hoje é string livre (`address_city`). Dois imóveis "São Paulo" / "Sao Paulo" não batem. Precisa normalização + código IBGE.
- **Cálculo client-side:** todo `simularTodosBancos` roda no React via `useMemo`. Adicionar regras complexas (ex: faixa progressiva, isenção MCMV) infla o bundle. Mitigar com função pura isolada e/ou Edge Function quando a regra for não trivial.
- **Cobertura nacional:** 5.570 municípios. Inviável validar todos manualmente. Necessário sistema de **nível de confiança** (oficial validado / oficial não validado / fallback estadual / nacional default) + UI que comunique a fonte.
- **Versionamento:** alíquotas mudam por lei municipal. Snapshot da simulação precisa congelar `itbi_rule_version` usada.
- **Regras municipais variam:** alíquota fixa, faixas progressivas (ex: SP capital tem 1% até X e 3% acima), isenção MCMV/primeiro imóvel, base de cálculo (venal vs venda). O modelo precisa suportar JSON estruturado, não só `rate numeric`.
- **UI atual** só pede UF. Precisa coletar cidade (com autocomplete IBGE) sem atrapalhar UX do simulador.

---

## 8. Sugestão inicial de arquitetura

### 8.1 Tabelas novas

```sql
-- Catálogo IBGE (seed nacional, ~5570 linhas, sem org_id — global)
ibge_municipios (
  ibge_code        text PRIMARY KEY,   -- 7 dígitos
  uf               char(2) NOT NULL,
  name             text NOT NULL,
  name_normalized  text NOT NULL,      -- lowercase sem acento (busca)
  capital          boolean DEFAULT false
);
CREATE INDEX ON ibge_municipios (uf, name_normalized);

-- Regras de ITBI versionadas (global, mantidas pela plataforma)
itbi_rules (
  id              uuid PRIMARY KEY,
  scope           text NOT NULL,                -- 'municipio' | 'uf' | 'nacional'
  ibge_code       text REFERENCES ibge_municipios,
  uf              char(2),
  rule            jsonb NOT NULL,               -- ver shape abaixo
  source_url      text,                         -- lei municipal / decreto
  source_label    text,                         -- "Lei 14.256/2007 - SP capital"
  confidence      text NOT NULL,                -- 'oficial_validada' | 'oficial' | 'estimativa_uf' | 'fallback'
  effective_from  date NOT NULL,
  effective_to    date,                         -- NULL = vigente
  version         int NOT NULL DEFAULT 1,
  is_active       boolean DEFAULT true,
  created_by      uuid,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX ON itbi_rules (ibge_code, is_active, effective_from DESC);

-- Overrides por organização (corretor com info melhor que a plataforma)
itbi_org_overrides (
  id              uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  ibge_code       text NOT NULL,
  rule            jsonb NOT NULL,
  notes           text,
  created_by      uuid,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (organization_id, ibge_code)
);
```

**Shape do `rule` (jsonb):** suporta os 3 formatos comuns sem migração futura:
```json
{
  "type": "flat",          // alíquota única
  "rate": 3.0,
  "base": "maior_entre_venal_e_venda"
}
{
  "type": "progressive",   // faixas (caso SP capital)
  "brackets": [
    { "up_to": 113405.10, "rate": 1.0 },
    { "rate": 3.0 }
  ],
  "base": "venda"
}
{
  "type": "financed_split",   // SFH com parcela financiada reduzida
  "rate_financed": 0.5,
  "rate_unfinanced": 3.0
}
```
Mais variantes (isenção MCMV, primeiro imóvel) entram como flags em `rule.exemptions[]`.

### 8.2 Resolver

Função `public.resolve_itbi(p_ibge text, p_uf text, p_org uuid)` (SQL stable):
1. `itbi_org_overrides` por `(org, ibge)` → retorna se existir.
2. `itbi_rules` ativa, mais recente, escopo município.
3. `itbi_rules` ativa escopo UF.
4. Fallback nacional (3%, confiança `fallback`).

Calculadora pura em `src/lib/itbi/calculate.ts` recebe `(rule, propertyValue, financedValue, flags)` e retorna `{ valor, breakdown, confidence, sourceLabel, ruleVersion }`. Testável isoladamente.

### 8.3 Integração no simulador

- Novo input no `FinancingSimulator.tsx`: **autocomplete de cidade** (CommandBox sobre `ibge_municipios`, filtrando por UF). UF seleciona → cidade carrega.
- Hook `useItbiRule({ ibgeCode, uf, propertyValue, financedValue })` retorna `{ data, isLoading, source, confidence }`.
- Substitui o cálculo atual `valorImovel × ITBI_RATES[UF] / 100`.
- `SimulationResults` aba "Custos" passa a exibir:
  - Valor + linha "Base: maior valor entre venal e venda" (do rule).
  - Badge de confiança colorida (verde/âmbar/vermelho).
  - Link "Fonte: Lei XYZ" se houver `source_url`.
  - Tooltip "Estimativa baseada no estado — confirme com a prefeitura" quando fallback.

### 8.4 Persistência da simulação

`simulacoes_financiamento` ganha:
```sql
ALTER TABLE simulacoes_financiamento
  ADD COLUMN itbi_value numeric,
  ADD COLUMN itbi_ibge_code text,
  ADD COLUMN itbi_rule_version int,
  ADD COLUMN itbi_rule_snapshot jsonb,   -- congela a regra usada
  ADD COLUMN itbi_confidence text;
```

### 8.5 Escalabilidade nacional (5.570 municípios)

Estratégia incremental por confiança:
1. **Seed inicial:** importar IBGE completo (CSV oficial) + popular `itbi_rules` com 1 linha por UF (`scope='uf'`, confidence='estimativa_uf'). Cobre 100% dos casos imediatamente via fallback.
2. **Fase 2:** popular ~150 maiores municípios (capitais + RMs) com regras oficiais validadas (confidence='oficial_validada'). Cobre ~70% da população.
3. **Fase 3:** crowd-source via overrides de organizações + revisão manual → promover para `itbi_rules` global.
4. **Edge Function** `itbi-rules-import` (admin only) para bulk upload via CSV/JSON.
5. **Auditoria:** view `vw_itbi_coverage` mostra % de municípios com regra oficial vs fallback.

### 8.6 RLS

- `ibge_municipios`, `itbi_rules`: SELECT público (anon+authenticated). INSERT/UPDATE/DELETE apenas `is_system_admin()`.
- `itbi_org_overrides`: full CRUD para `is_org_manager_or_above()` da própria org.

### 8.7 Arquivos a criar/alterar

**Novos**
- `supabase/migrations/<ts>_itbi_foundation.sql` — tabelas + resolver + RLS + seed nacional UF.
- `supabase/functions/itbi-rules-import/index.ts` — bulk admin.
- `src/lib/itbi/calculate.ts` — calculadora pura por shape.
- `src/lib/itbi/types.ts` — tipos do `rule` jsonb.
- `src/hooks/financing/useItbiRule.ts` — resolver + cálculo.
- `src/hooks/financing/useIbgeMunicipios.ts` — autocomplete.
- `src/components/financing/inputs/CityAutocomplete.tsx` — UI.
- `src/components/financing/results/ItbiBadge.tsx` — confiança + fonte.

**Alterar**
- `src/components/financing/FinancingSimulator.tsx` — substituir Select UF puro por UF + cidade.
- `src/components/financing/SimulationResults.tsx` — aba Custos consome novo resolver.
- `src/constants/bancos-financiamento.ts` — `ITBI_RATES` vira fallback documentado (ou removido).
- `simulacoes_financiamento` — colunas de snapshot ITBI.

### 8.8 Resultado esperado
- Cobertura nacional desde o dia 1 (via fallback UF) com caminho claro de evolução por confiança.
- Regras versionadas, auditáveis e congeladas no snapshot da simulação.
- Suporte a alíquota fixa, progressiva e split SFH sem precisar nova migração.
- Overrides por org permitem corretor refinar localmente.
- UX comunica claramente "valor exato vs estimativa" via badge de confiança.

