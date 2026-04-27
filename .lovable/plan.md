# Fase 3 — Controle de Revisão de Imóveis (Build)

Plano final auditado, alinhado aos ajustes obrigatórios. Implementação direta após aprovação.

## Achados de auditoria (confirmados via SQL)

- `properties.status` valores reais: `disponivel, reservado, vendido, inativo`. **Não existe `com_proposta`** → dashboard filtrará por `('disponivel','reservado')` e índice será **genérico** (sem cláusula parcial) para evitar dependência da lista.
- `owners.primary_name` é a coluna de nome (não `full_name`).
- `property_owners.is_primary` existe.
- `app_role` inclui `admin, sub_admin, leader, developer` (também `corretor, assistente, atendente, desenvolvedor`).
- `search_properties_advanced` **não tem tenant guard** hoje — será adicionado.
- `usePropertyReview` já existe e invalida `properties-list`, `properties-advanced-search`, etc.
- `PropertyReviewBadge` é usado em `PropertyCard`, `PropertyListItem`, `OwnerPropertyListItem`.
- `StalePropertiesAlert` só é importado em `Dashboard.tsx` — será substituído mas o arquivo será **mantido** no repo.
- `useUserRoles().isAdminOrAbove` cobre admin/sub_admin/leader/developer.
- Tabela `property_review_settings` ainda não existe.

## 1. Migration

### 1.1 Tabela `property_review_settings`

```sql
CREATE TABLE public.property_review_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  overdue_after_days  integer NOT NULL DEFAULT 60,
  warning_before_days integer NOT NULL DEFAULT 15,
  show_dashboard_card boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prs_overdue_range CHECK (overdue_after_days BETWEEN 7 AND 365),
  CONSTRAINT prs_warning_range CHECK (warning_before_days BETWEEN 1 AND 60),
  CONSTRAINT prs_warning_lt_overdue CHECK (warning_before_days < overdue_after_days)
);

ALTER TABLE public.property_review_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: membros da própria org
CREATE POLICY "prs_select_own_org"
  ON public.property_review_settings
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- INSERT: admin/sub_admin/leader/developer da própria org
CREATE POLICY "prs_insert_admins"
  ON public.property_review_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'sub_admin'::app_role)
      OR public.has_role(auth.uid(), 'leader'::app_role)
      OR public.has_role(auth.uid(), 'developer'::app_role)
    )
  );

-- UPDATE: idem
CREATE POLICY "prs_update_admins"
  ON public.property_review_settings
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'sub_admin'::app_role)
      OR public.has_role(auth.uid(), 'leader'::app_role)
      OR public.has_role(auth.uid(), 'developer'::app_role)
    )
  )
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Sem DELETE policy (intencional)

CREATE TRIGGER trg_prs_updated_at
  BEFORE UPDATE ON public.property_review_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 1.2 Índice

Genérico (status enum não inclui `com_proposta` — evitar surpresas):
```sql
CREATE INDEX IF NOT EXISTS idx_properties_org_last_reviewed
  ON public.properties (organization_id, last_reviewed_at NULLS FIRST);
```

### 1.3 RPC `search_properties_advanced` — tenant guard + 3 novos status

`CREATE OR REPLACE` mantendo assinatura. Mudanças:

1. **Tenant guard** no início (LANGUAGE plpgsql wrapper; ou via `WHERE` com COALESCE+EXCEPTION). Estratégia: converter para `LANGUAGE plpgsql` mantendo retorno via `RETURN QUERY` com a mesma SQL. Adicionar:
```sql
DECLARE v_user_org uuid := public.get_user_organization_id();
BEGIN
  IF v_user_org IS NULL OR p_organization_id <> v_user_org THEN
    RETURN; -- vazio, sem vazar dados cross-tenant
  END IF;
  ...
```
2. **CTE `cfg`** para resolver thresholds:
```sql
WITH cfg AS (
  SELECT COALESCE(s.overdue_after_days, 60)  AS overdue_days,
         COALESCE(s.warning_before_days, 15) AS warning_days
  FROM (SELECT p_organization_id AS oid) x
  LEFT JOIN public.property_review_settings s ON s.organization_id = x.oid
)
```
3. **3 novos valores em `p_review_status`** (preferir `interval` numérico):
```sql
OR (p_review_status = 'overdue_configured'
    AND (p.last_reviewed_at IS NULL
         OR p.last_reviewed_at < now() - ((SELECT overdue_days FROM cfg) * interval '1 day')))
OR (p_review_status = 'near_due'
    AND p.last_reviewed_at IS NOT NULL
    AND p.last_reviewed_at <  now() - (((SELECT overdue_days FROM cfg) - (SELECT warning_days FROM cfg)) * interval '1 day')
    AND p.last_reviewed_at >= now() - ((SELECT overdue_days FROM cfg) * interval '1 day'))
OR (p_review_status = 'within_due'
    AND p.last_reviewed_at IS NOT NULL
    AND p.last_reviewed_at >= now() - (((SELECT overdue_days FROM cfg) - (SELECT warning_days FROM cfg)) * interval '1 day'))
```
Todos os filtros existentes preservados; paginação/`total_count` intactos.

### 1.4 Nova RPC `get_property_review_dashboard(p_limit int DEFAULT 10)`

```sql
CREATE OR REPLACE FUNCTION public.get_property_review_dashboard(p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.get_user_organization_id();
  v_overdue int;
  v_warning int;
  v_safe int;
  v_counts jsonb;
  v_critical jsonb;
BEGIN
  IF v_org IS NULL THEN
    RETURN jsonb_build_object(
      'overdue_count', 0, 'never_count', 0, 'warning_count', 0,
      'overdue_after_days', 60, 'warning_before_days', 15,
      'critical', '[]'::jsonb
    );
  END IF;

  SELECT COALESCE(s.overdue_after_days, 60),
         COALESCE(s.warning_before_days, 15)
    INTO v_overdue, v_warning
  FROM (SELECT v_org AS oid) x
  LEFT JOIN public.property_review_settings s ON s.organization_id = x.oid;

  v_safe := v_overdue - v_warning;

  -- Sem dupla contagem:
  --  never_count   = last_reviewed_at IS NULL
  --  overdue_count = NOT NULL AND vencido
  --  warning_count = NOT NULL AND janela de aviso AND ainda não vencido
  SELECT jsonb_build_object(
    'never_count',   count(*) FILTER (WHERE last_reviewed_at IS NULL),
    'overdue_count', count(*) FILTER (WHERE last_reviewed_at IS NOT NULL
                       AND last_reviewed_at <  now() - (v_overdue * interval '1 day')),
    'warning_count', count(*) FILTER (WHERE last_reviewed_at IS NOT NULL
                       AND last_reviewed_at <  now() - (v_safe    * interval '1 day')
                       AND last_reviewed_at >= now() - (v_overdue * interval '1 day')),
    'overdue_after_days', v_overdue,
    'warning_before_days', v_warning
  ) INTO v_counts
  FROM public.properties
  WHERE organization_id = v_org
    AND status::text IN ('disponivel','reservado');

  -- Lista crítica: nunca + vencidos + próximos
  SELECT jsonb_agg(row_to_json(t))
    INTO v_critical
  FROM (
    SELECT
      p.id,
      p.title,
      p.property_code::text AS property_code,
      p.status::text AS status,
      p.last_reviewed_at,
      CASE WHEN p.last_reviewed_at IS NULL THEN NULL
           ELSE EXTRACT(day FROM now() - p.last_reviewed_at)::int END AS days_since,
      CASE
        WHEN p.last_reviewed_at IS NULL THEN 1
        WHEN p.last_reviewed_at <  now() - (v_overdue * interval '1 day') THEN 2
        ELSE 3
      END AS priority,
      (
        SELECT o.primary_name
        FROM public.property_owners po
        JOIN public.owners o ON o.id = po.owner_id
        WHERE po.property_id = p.id
        ORDER BY po.is_primary DESC NULLS LAST
        LIMIT 1
      ) AS owner_name
    FROM public.properties p
    WHERE p.organization_id = v_org
      AND p.status::text IN ('disponivel','reservado')
      AND (
        p.last_reviewed_at IS NULL
        OR p.last_reviewed_at < now() - (v_safe * interval '1 day')
      )
    ORDER BY priority ASC, days_since DESC NULLS FIRST
    LIMIT GREATEST(COALESCE(p_limit, 10), 1)
  ) t;

  RETURN v_counts || jsonb_build_object('critical', COALESCE(v_critical, '[]'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.get_property_review_dashboard(int) FROM public;
GRANT EXECUTE ON FUNCTION public.get_property_review_dashboard(int) TO authenticated;
```

## 2. Hooks

### `src/hooks/usePropertyReviewSettings.ts` (novo)
- React Query, key `['property-review-settings', organization_id]`, `staleTime: 5*60_000`.
- `select * from property_review_settings where organization_id=...`. Se sem linha → defaults `{overdueAfterDays:60, warningBeforeDays:15, showDashboardCard:true}`.
- Exporta tipo `PropertyReviewSettings` e helper puro:
```ts
export function classifyReview(last: string|null|undefined, s: PropertyReviewSettings):
  'fresh'|'near_due'|'overdue'|'never' {
  if (!last) return 'never';
  const days = Math.floor((Date.now() - new Date(last).getTime())/86400000);
  if (days > s.overdueAfterDays) return 'overdue';
  if (days > s.overdueAfterDays - s.warningBeforeDays) return 'near_due';
  return 'fresh';
}
export const DEFAULT_REVIEW_SETTINGS: PropertyReviewSettings =
  { overdueAfterDays: 60, warningBeforeDays: 15, showDashboardCard: true };
```

### `src/hooks/useUpdatePropertyReviewSettings.ts` (novo)
- Mutation upsert `onConflict: 'organization_id'`.
- Invalida `['property-review-settings', orgId]`, `['property-review-dashboard', orgId]`, `['properties-advanced-search']`, `['properties-list']` (badges/filtros refletirem nova config).

### `src/hooks/usePropertyReviewDashboard.ts` (novo)
- `supabase.rpc('get_property_review_dashboard', { p_limit: 10 })`.
- Key `['property-review-dashboard', organization_id]`, `staleTime: 2*60_000`.
- **Aceita opção `enabled`** — usado pelo dashboard quando `show_dashboard_card=false` para não chamar a RPC.

## 3. Hooks alterados

- `usePropertyFilters.ts` — manter tipo `reviewStatus: string` (já é string genérica). Sem mudanças estruturais. **Adicionar mapeamento de label** no PropertyFilters (ver §4).
- `useAdvancedPropertySearch.ts` — sem mudança (já repassa `reviewStatus`).

## 4. UI — alterações

### `src/components/properties/PropertyReviewBadge.tsx` (refator)
- **NÃO chamar hook internamente**. Aceita prop opcional `settings?: PropertyReviewSettings`.
- Se `settings` ausente, usa `DEFAULT_REVIEW_SETTINGS` (60/15/true) — sem hooks/queries no badge.
- Usa `classifyReview` para determinar nível: `fresh|near_due|overdue|never`.
- Mantém labels: "Revisado hoje" / "Revisado há X dias" / "Nunca revisado". Mantém modo `compact`.
- Cores: fresh=verde, near_due=amarelo, overdue=vermelho, never=cinza com borda.

### `src/components/properties/PropertyFilters.tsx`
- Adicionar 3 itens no Select de Revisão (após `never`):
  - `overdue_configured` → "Desatualizados (configuração)"
  - `near_due` → "Próximos do prazo"
  - `within_due` → "Dentro do prazo seguro"
- Atualizar mapa de labels do badge ativo (linhas 578-586) com as 3 entradas.

### `src/components/properties/PropertyCard.tsx`, `PropertyListItem.tsx`, `OwnerPropertyListItem.tsx`
- Aceitar prop opcional `reviewSettings` e repassar ao `PropertyReviewBadge`. Onde renderizado em listas, a página pai busca settings 1× e propaga.

### Páginas que renderizam listas
- `Properties.tsx` (e equivalentes) — chamar `usePropertyReviewSettings()` 1× e propagar via prop. Se a página atual já mapeia cards num loop, passar `reviewSettings={settings}` em cada item.
- `OwnerDetails.tsx` — idem para a lista de imóveis do proprietário.
- (Se a propagação por prop exigir alterações grandes em muitos lugares, manter o badge funcionando com defaults — comportamento já equivalente a Fase 2 quando settings = 60/15.)

### Configuração — `src/components/settings/PropertyReviewSettingsCard.tsx` (novo)
- Card com:
  - Title: "Controle de revisão de imóveis"
  - Number input: "Considerar imóvel desatualizado após X dias" (7–365)
  - Number input: "Avisar quando estiver faltando X dias" (1–60)
  - Switch: "Exibir imóveis desatualizados no dashboard"
- Validação client-side espelhando os CHECKs (warning < overdue, ranges).
- Gate: `useUserRoles().isAdminOrAbove`. Sem permissão → inputs `disabled`, sem botão Salvar.
- Mutation via `useUpdatePropertyReviewSettings`.
- Integrado no final de `SettingsCompanyTab.tsx` (antes do `</div>` final).

### Dashboard — `src/components/dashboard/PropertyReviewDashboardCard.tsx` (novo)
- Usa `usePropertyReviewSettings` + `usePropertyReviewDashboard({ enabled: settings.showDashboardCard })`.
- Se `!settings.showDashboardCard` → retorna `null` (não chama RPC).
- Estados:
  - Loading → Skeleton.
  - Erro → mensagem discreta + botão "Tentar novamente" (refetch).
  - Vazio (todos zero) → mensagem "Todos os imóveis estão dentro do prazo de revisão." (ou ocultar — escolher: ocultar para reduzir ruído).
- Conteúdo:
  - Header com 3 contadores (overdue, never, warning) + "Ver todos" → `/imoveis?revisao=overdue_configured`.
  - Lista até 10 imóveis (do `critical[]`): título, código, owner_name, badge usando `<PropertyReviewBadge settings={settings} ...>`, dias.
  - Ação "Marcar como revisado" inline via `usePropertyReview()`.

### `src/pages/Dashboard.tsx`
- Substituir `<StalePropertiesAlert />` por `<PropertyReviewDashboardCard />` (mantido dentro do `<LazySection>`).
- **Não remover** `StalePropertiesAlert.tsx` do repo (mantido como deprecated — sem imports após esta troca).

## 5. Segurança / Multi-tenant

- `property_review_settings`: RLS estrita por org + role para escrita; sem DELETE policy.
- `search_properties_advanced`: tenant guard server-side (rejeita `p_organization_id` ≠ org do usuário).
- `get_property_review_dashboard`: `SECURITY DEFINER`, deriva org de `auth.uid()`, **não recebe org do client**.
- Frontend nunca envia `organization_id` para a nova RPC.

## 6. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| `LANGUAGE sql` impede `IF` no guard | Converter `search_properties_advanced` para `plpgsql` com `RETURN QUERY` |
| Quebra de chamadas existentes da RPC | Assinatura preservada; comportamento idêntico para callers da própria org |
| Dupla contagem no dashboard | FILTERs distinguem NULL vs vencido vs aviso |
| N+1 settings em listas | Página busca 1×; badge usa default puro quando prop ausente |
| `showDashboardCard=false` ainda dispara RPC | Hook com `enabled` e curto-circuito no componente |
| Status `com_proposta` não existe | Dashboard filtra `('disponivel','reservado')`; índice genérico |

## 7. Ordem de implementação

1. **Migration** (tudo em uma): tabela + RLS + índice + `search_properties_advanced` (rewrite plpgsql) + `get_property_review_dashboard`.
2. **Hooks** novos (3) + helper `classifyReview` + `DEFAULT_REVIEW_SETTINGS`.
3. **Refator** `PropertyReviewBadge` (sem hook).
4. **PropertyFilters**: 3 opções + labels.
5. **PropertyReviewSettingsCard** + integração em `SettingsCompanyTab`.
6. **PropertyReviewDashboardCard** + substituição em `Dashboard.tsx`.
7. **Validação**: `npx tsc --noEmit` + `npx vite build`.
8. `supabase--linter` para validar RLS.

## 8. Checklist de validação manual

- Configuração visível em Configurações > Empresa; admin salva 45/10 e persiste; cliente bloqueia 60/70.
- Toggle `show_dashboard_card=false` → card some no Dashboard e RPC não é chamada (verificar Network).
- Badge: 10d→verde, 50d (60/15)→amarelo, 70d→vermelho, null→cinza.
- Filtros: 3 novos valores retornam conjuntos esperados; URL `?revisao=overdue_configured` aplica.
- Dashboard: 3 contadores corretos; ordenação never→mais dias→vencidos→próximos; "Ver todos" aplica filtro; "Marcar como revisado" remove item.
- Multi-tenant: outra org não vê imóveis cross-tenant; tentativa de `search_properties_advanced` com `p_organization_id` de outra org retorna vazio.

## 9. Fora do escopo

Notificações automáticas, WhatsApp, automações, relatório semanal, histórico completo de revisões, auditoria por usuário, IA outbound, tarefas recorrentes.
