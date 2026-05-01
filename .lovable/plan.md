# Enxugamento Operacional — Developer-Only Gating + 3 Planos

## Objetivo

Esconder funcionalidades avançadas de usuários comuns sem remover código, banco, rotas ou edge functions. Tudo continua acessível para `developer`. Reduzir vitrine para 3 planos: **Essencial**, **Profissional**, **Imobiliária**.

---

## 1. Camada centralizada (`src/config/featureAccess.ts`)

Fonte única da verdade com:

- **Chaves estáveis** em `DEVELOPER_ONLY_FEATURES`: `crm.whatsapp_templates`, `financeiro.templates`, `financeiro.financiamentos`, `correspondente`, `marketing.gerador_ia`, `marketing.artes`, `marketing.video`, `marketing.marca`, `meu_whatsapp`, `automacoes`, `gestao.portais_anuncio`, `gestao.meu_site`, `gestao.canais_equipe`.
- **Rotas developer-only** (`DEVELOPER_ONLY_ROUTES`): `/correspondente`, `/financiamentos`, `/automacoes`, `/whatsapp/meu-canal`, `/whatsapp/automacoes`, `/whatsapp/canais-equipe`.
- Helper `isDeveloperOnlyRoute(path)` que cobre subrotas (ex. `/whatsapp/meu-canal/chat`).
- `isDeveloperOnlyFeature(key)`.

## 2. Hook `useFeatureAccess` (`src/hooks/useFeatureAccess.ts`)

Reaproveita `useUserRoles()`. Expõe `canAccessFeature(key)` e `canAccessRoute(path)`. Durante `isLoading`, retorna `false` (esconde) — evita flicker.

## 3. Componentes (`src/components/access/`)

- **`DeveloperOnly.tsx`** — wrapper declarativo: `<DeveloperOnly featureKey={...}>...</DeveloperOnly>`. Renderiza `null`/fallback enquanto carrega ou se bloqueado.
- **`DeveloperOnlyRoute.tsx`** — guarda de rota: spinner enquanto carrega; se não-developer → `<Navigate to="/dashboard" replace />` com toast `"Esse recurso está temporariamente restrito."` (toast disparado uma única vez por ref).

## 4. Sidebar (`src/components/AppSidebar.tsx`)

Visível para todos: Dashboard, Métricas, Imóveis, Proprietários, CRM, Agenda, Marketplace, Financeiro, Marketing.

Esconder para não-developer:
- **Correspondente** (remover do array base; render condicional via `isDeveloper`).
- **Meu WhatsApp**.
- **Automações** (já era admin; passa a developer).

Grupo "Gestão" para não-developer mostra apenas **Administração** e **Integrações**. Esconder:
- **Meu Site** (`/site`).
- **Canais da Equipe** (`/whatsapp/canais-equipe`).

Implementação: trocar `mainItems` para incluir um campo `developerOnly?: boolean` (ou render condicional explícito) usando `useUserRoles().isDeveloper`.

## 5. Abas internas

**`src/pages/CRM.tsx`** — aba `templates` (WhatsApp Templates):
- Trigger e content envolvidos por `<DeveloperOnly featureKey={DEVELOPER_ONLY_FEATURES.CRM_WHATSAPP_TEMPLATES}>`.
- `useEffect`: se `tab === "templates"` e usuário não-developer, `setTab("active")`.

**`src/pages/Financial.tsx`** — abas `templates` e `financiamentos`:
- Triggers e contents gated.
- `useEffect`: se `finTab` em `["templates","financiamentos"]` e não-developer → `setFinTab("transactions")`.

**`src/pages/Anuncios.tsx`** — abas `gerador`, `artes`, `video`, `marca`:
- Triggers e contents gated.
- `useEffect`: se `section` em lista restrita e não-developer → `setSection("meta")`.

**`src/pages/Integrations.tsx`** — `<PortalFeedsSection />` envolvido em `<DeveloperOnly featureKey={GESTAO_PORTAIS_ANUNCIO}>`. Separator condicional para não deixar separador órfão.

## 6. Rotas em `src/App.tsx`

Envolver com `<DeveloperOnlyRoute>`:
- `/correspondente`
- `/automacoes`
- `/whatsapp/meu-canal`
- `/whatsapp/meu-canal/chat`
- `/whatsapp/automacoes`
- `/whatsapp/canais-equipe`

Obs: `/financiamentos` não é rota top-level — vive como aba dentro de `/financeiro` (já gated). Se um dia virar rota separada, o array `DEVELOPER_ONLY_ROUTES` já cobre.

## 7. Migração de planos

**Arquivo:** `supabase/migrations/<ts>_collapse_plans_to_three.sql`

Estado atual relevante (`subscription_plans`, plan_type='plan' ativos): `gratuito`, `starter`, `correspondente`, `enterprise`, `essencial`, `profissional`, `business`.

Estratégia (sem deletar nada, sem tocar `subscriptions`):

```sql
-- 1) Desativar todos os planos type='plan', exceto os 3 escolhidos
UPDATE public.subscription_plans
SET is_active = false
WHERE plan_type = 'plan'
  AND slug NOT IN ('essencial', 'profissional', 'business');

-- 2) Reativar e reordenar os 3
UPDATE public.subscription_plans
SET is_active = true, display_order = 1,
    name = 'Essencial',
    description = 'Imóveis, leads, portfólio básico e CRM simples.'
WHERE slug = 'essencial';

UPDATE public.subscription_plans
SET is_active = true, display_order = 2,
    name = 'Profissional',
    description = 'Tudo do Essencial + marketplace, colaboração e integrações básicas.'
WHERE slug = 'profissional';

-- "business" é exibido como Imobiliária (mantém slug por causa de FKs/lógica enterprise)
UPDATE public.subscription_plans
SET is_active = true, display_order = 3,
    name = 'Imobiliária',
    description = 'Tudo do Profissional + multiusuários, administração, permissões e operação de equipe.'
WHERE slug = 'business';

-- 3) Desligar flags developer-only nos 3 planos visíveis
UPDATE public.subscription_plans
SET features = COALESCE(features, '{}'::jsonb) || jsonb_build_object(
  'has_automations',     false,
  'has_whatsapp',        false,
  'has_ad_generator',    false,
  'has_brand_settings',  false,
  'has_meta_ads',        false,
  'has_rd_station',      false,
  'has_contracts',       false,
  'has_contract_ai',     false,
  'has_pdf_extract',     false,
  'financing_simulator', false,
  'financing_pipeline',  false,
  'financing_docs_checklist', false,
  'has_xml_feed',        false  -- portais de anúncio
)
WHERE slug IN ('essencial', 'profissional', 'business');
```

Notas:
- `business` mantém o slug — `useSubscription` reconhece `business`/`enterprise` como enterprise-class (uncapped). Apenas o **nome exibido** muda para "Imobiliária".
- Subscriptions ativas em planos antigos continuam intactas (planos só ficam `is_active=false`, registro preservado).
- Como UI é blindada por `DeveloperOnly`, a UI fica limpa mesmo se o usuário ainda estiver num plano antigo com flags ligadas.
- Página `/planos` já lista apenas `is_active=true` ordenados por `display_order` → mostra exatamente 3.

## Critérios de aceite

- Developer vê tudo (sidebar, abas, rotas).
- Não-developer não vê: WhatsApp Templates (CRM); Templates e Financiamentos (Financeiro); Correspondente; Gerador IA/Artes/Vídeo/Marca (Marketing); Meu WhatsApp; Automações; Portais (Integrações); Meu Site e Canais da Equipe (Gestão).
- Acesso direto às rotas restritas redireciona para `/dashboard` com toast.
- `/planos` mostra exatamente 3 planos ativos.
- Build e typecheck passam.
- Nenhuma tabela, migration, edge function, dado ou subscription é removido.

## Arquivos

**Criar (4):** `src/config/featureAccess.ts`, `src/hooks/useFeatureAccess.ts`, `src/components/access/DeveloperOnly.tsx`, `src/components/access/DeveloperOnlyRoute.tsx`, migration SQL.

**Editar (5):** `src/components/AppSidebar.tsx`, `src/pages/CRM.tsx`, `src/pages/Financial.tsx`, `src/pages/Anuncios.tsx`, `src/pages/Integrations.tsx`, `src/App.tsx`.

## Reversibilidade

- Reativar feature: remover chave de `DEVELOPER_ONLY_FEATURES` ou rota de `DEVELOPER_ONLY_ROUTES`.
- Reativar plano antigo: `UPDATE subscription_plans SET is_active = true WHERE slug = '...'`.
