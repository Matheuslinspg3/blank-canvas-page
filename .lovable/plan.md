

# Plan: FASE G1 — Painel de Rollout do Site Builder Advanced v2

## Summary

Create a DEV admin dashboard at `/dev/site-builder-rollout` listing all organizations with their migration status, filters, metrics, quick links, and inline documentation.

## Data Source

A single SQL query joining `organizations`, `site_documents`, and `website_settings` provides all needed data. This will use `supabase.rpc` or a direct query via the anon key (tables already have public RPCs or permissive policies for DEV routes).

Since direct table access may be restricted, create a new `SECURITY DEFINER` RPC `dev_list_org_rollout_status` that returns the joined data.

## Changes

### 1. New RPC: `dev_list_org_rollout_status` (migration)

```sql
CREATE OR REPLACE FUNCTION public.dev_list_org_rollout_status()
RETURNS TABLE (
  org_id uuid,
  org_name text,
  editor_mode text,
  has_published_v1 boolean,
  has_draft_v2 boolean,
  has_published_v2 boolean,
  site_template text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id,
    o.name,
    COALESCE(sd.editor_mode, 'simple'),
    (sd.published IS NOT NULL),
    (sd.draft_v2 IS NOT NULL),
    (sd.published_v2 IS NOT NULL),
    ws.site_template::text
  FROM organizations o
  LEFT JOIN site_documents sd ON sd.organization_id = o.id
  LEFT JOIN website_settings ws ON ws.organization_id = o.id
  ORDER BY o.name;
$$;
```

### 2. New page: `src/pages/DevSiteBuilderRollout.tsx`

**Top section — Metrics counters:**
- Total orgs
- Simple mode
- Advanced mode
- With `published_v2`
- With `draft_v2` but no `published_v2`
- Fallback-only (no site_documents row or no published content)

Displayed as small stat cards in a row.

**Middle section — Filters:**
- Dropdown or toggle chips: All / Simple only / Advanced only / With published_v2 / Draft without publish
- Client-side filtering on the fetched data.

**Table columns:**
- Org name
- `editor_mode` (badge: `simple` gray, `advanced` green)
- Published v1 (✅/❌)
- Draft v2 (✅/❌)
- Published v2 (✅/❌)
- Template legado
- Status (computed badge):
  - `legacy-only`: no draft_v2, no published_v2
  - `v2-draft-ready`: has draft_v2, no published_v2
  - `v2-published`: has published_v2, mode still simple
  - `advanced-active`: mode = advanced + has published_v2
- Actions: two icon buttons linking to `/dev/migrate-site-v2?orgId=...` and `/dev/storefront-v2?orgId=...`

**Bottom section — Inline documentation:**
A collapsible card with markdown-rendered operational guide covering:
- How to migrate an org (step-by-step)
- How to publish
- How to revert to simple
- How to validate storefront
- When NOT to migrate

Uses the existing `LazyMarkdown` component for rendering.

### 3. Route registration in `App.tsx`

```tsx
const DevSiteBuilderRollout = lazy(() => lazyRetry(() => import("./pages/DevSiteBuilderRollout")));
// Add route alongside other /dev/ routes
<Route path="/dev/site-builder-rollout" element={<Suspense ...><DevSiteBuilderRollout /></Suspense>} />
```

### 4. No production changes

No modifications to Storefront, SiteBuilderPro, or any production component.

## Files

| File | Action |
|------|--------|
| `src/pages/DevSiteBuilderRollout.tsx` | Create |
| `src/App.tsx` | Update — add route + lazy import |
| Migration SQL | Create `dev_list_org_rollout_status` RPC |

## Validation

1. Navigate to `/dev/site-builder-rollout`
2. Confirm all 10 orgs appear with correct statuses
3. Confirm Porto Caiçara shows `advanced-active` and Teste Corretor shows `advanced-active`
4. Confirm filters work
5. Confirm quick links navigate correctly
6. Run `tsc --noEmit`
7. Screenshot

