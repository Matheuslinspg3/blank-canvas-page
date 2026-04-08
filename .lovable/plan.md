

# Plan: FASE E — Persistência real + Renderer público v2

## Current State

- `SiteBuilderPro.tsx` already loads `draft_v2`, autosaves via `useSaveDraftV2`, and publishes via `usePublishSiteV2` — this is wired correctly
- `Storefront.tsx` already checks `siteDoc?.editor_mode === 'advanced'` and renders `SiteDocumentRendererV2` — but that component is a stub ("em construção")
- The RPC `get_public_site_document_full` correctly returns `editor_mode` + the right `layout` (published_v2 for advanced, published for simple)
- `buildSeedLayout` exists and is reusable
- `SectionRenderer` in `src/components/siteBuilder/v2/SectionRenderer.tsx` already renders sections/rows/columns/elements with mobile fallback

## Changes

### 1. Extract `buildSeedLayout` to a shared helper
**File**: `src/lib/buildInitialSiteLayoutV2.ts` (new)

Move `buildSeedLayout` into a standalone `buildInitialSiteLayoutV2(theme?)` function. Re-export from `useSiteBuilderProState.ts` for backward compatibility. Used by both `SiteBuilderPro.tsx` and `DevSiteBuilderPro.tsx`.

### 2. Implement `SiteDocumentRendererV2` for real
**File**: `src/components/storefront/v3/SiteDocumentRendererV2.tsx`

Replace the stub with a real renderer that:
- Iterates `siteLayout.sections` in order
- Skips sections where `visible === false`
- Reuses the existing `SectionRenderer` from `src/components/siteBuilder/v2/SectionRenderer.tsx` with `isEditing={false}`
- Passes `properties` through (for property_list/property_card/property_carousel elements)
- Applies theme font-family on the wrapper div

### 3. Update Storefront SEO for v2 meta
**File**: `src/pages/Storefront.tsx`

When `editor_mode === 'advanced'` and `siteDoc.layout` exists:
- Use `siteLayout.meta.title` for SEO title (fallback to existing `metaTitle`)
- Use `siteLayout.meta.description` for SEO description (fallback to existing `metaDesc`)

### 4. No database changes needed
The RPC and columns (`draft_v2`, `published_v2`, `editor_mode`) already exist and work correctly.

### 5. No changes to SiteBuilderPro.tsx
It already loads `draft_v2`, seeds with `buildSeedLayout` when null, autosaves, and publishes. No QA panel is present in the production page (it's only in DevSiteBuilderPro).

### 6. Validation
- Build `tsc --noEmit`
- Navigate to `/dev/site-builder-pro` to confirm editor still works
- Check storefront route to confirm renderer no longer shows stub text

## Files

| File | Action |
|------|--------|
| `src/lib/buildInitialSiteLayoutV2.ts` | Create — shared seed helper |
| `src/hooks/useSiteBuilderProState.ts` | Update — import from shared helper, re-export |
| `src/components/storefront/v3/SiteDocumentRendererV2.tsx` | Rewrite — real renderer using SectionRenderer |
| `src/pages/Storefront.tsx` | Update — SEO meta from v2 layout |
| `src/pages/DevSiteBuilderPro.tsx` | Update — import from shared helper |

