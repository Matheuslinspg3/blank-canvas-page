

# Plan: `/dev/storefront-v2` — Public DEV route for v2 renderer validation

## Summary

Create a public DEV route that uses real RPC data (no mocks, no auth) to validate the full advanced renderer pipeline, including a "publish draft for testing" button.

## Data State

- Org `cdf3f0e6-da64-4090-bc76-1758796bea28` has `editor_mode: advanced`, `has_draft_v2: true`, `has_published_v2: false`
- The RPC `get_public_site_document_full` is public (security definer) and works without auth
- `useSiteDocumentPublic` hook is ready to use

## Changes

### 1. New page: `src/pages/DevStorefrontV2.tsx`

**URL**: `/dev/storefront-v2?orgId=cdf3f0e6-da64-4090-bc76-1758796bea28`

The page will:

- Read `orgId` from query param (fallback to hardcoded org above)
- Call `useSiteDocumentPublic(orgId)` — the same hook used by the real Storefront
- Fetch properties from `marketplace_properties_public` (same as storefront)
- Display a **DEV info panel** at the top showing:
  - organizationId, editor_mode, has layout, layout.version, section count
  - source: "published_v2" or "fallback"
  - resolved meta title + description
- Below the panel, render:
  - If `editor_mode === 'advanced'` and layout exists → `SiteDocumentRendererV2`
  - Otherwise → message "Fallback: no published_v2 layout"

**Publish button**: When `published_v2` is null (layout is null despite advanced mode), show a button "Publicar draft_v2 para teste". This button will:
- Call supabase directly: `UPDATE site_documents SET published_v2 = draft_v2, last_published_at = now() WHERE organization_id = orgId`
- Invalidate the query cache so the page re-fetches
- This is DEV-only, no RLS issue since we use the anon key and the RPC is public

**Important**: The publish button needs to write to `site_documents`. Since the anon key may not have write access, I'll use a direct RPC or a simple edge function approach. Let me check if there's an existing publish mutation we can reuse publicly. If not, I'll create a small RPC `dev_publish_draft_v2` that's only callable in dev, or simply use the existing `usePublishSiteV2` pattern but note it requires auth. 

Alternative: The button can call the existing public RPC pattern. Since we can't write without auth, the button will instead show instructions or use a Supabase SQL approach. Most pragmatic: create a small SQL function `dev_force_publish_v2` with security definer that copies draft_v2 to published_v2.

### 2. New RPC: `dev_force_publish_v2` (migration)

```sql
CREATE OR REPLACE FUNCTION public.dev_force_publish_v2(p_org_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE site_documents 
  SET published_v2 = draft_v2, 
      last_published_at = now()
  WHERE organization_id = p_org_id 
    AND draft_v2 IS NOT NULL;
$$;
```

This is a security definer function callable without auth — acceptable for DEV/QA purposes. Can be dropped later.

### 3. Route registration in `App.tsx`

Add alongside other dev routes:
```tsx
const DevStorefrontV2 = lazy(() => lazyRetry(() => import("./pages/DevStorefrontV2")));
// ...
<Route path="/dev/storefront-v2" element={<DevStorefrontV2 />} />
```

### 4. Validation

After implementation:
1. Navigate to `/dev/storefront-v2?orgId=cdf3f0e6-...`
2. Confirm fallback state (published_v2 is null)
3. Click "Publicar draft_v2 para teste"
4. Confirm renderer v2 appears with real sections
5. Confirm DEV panel shows resolved meta
6. Take screenshots
7. Run `tsc --noEmit`

## Files

| File | Action |
|------|--------|
| `src/pages/DevStorefrontV2.tsx` | Create — DEV page |
| `src/App.tsx` | Update — add route |
| Migration | Create RPC `dev_force_publish_v2` |

