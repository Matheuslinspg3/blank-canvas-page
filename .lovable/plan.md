

# Plan: FASE F1 — Migração assistida legado → advanced v2

## Summary

Create a conversion helper that maps legacy `website_settings` + `brand` + template into a `SiteLayoutV2`, plus a DEV admin page at `/dev/migrate-site-v2` with side-by-side preview and migration actions.

## Changes

### 1. Conversion helper: `src/lib/convertLegacyToSiteLayoutV2.ts` (new)

**Input**: `{ website: StorefrontWebsite, brand: StorefrontBrand, org: StorefrontOrg, template: SiteTemplate }`

**Output**: `SiteLayoutV2`

The helper uses the existing `section/row/col/el` factory functions from `sectionTemplates/helpers.ts` to build sections. It maps:

- **Hero**: `hero_title`, `hero_subtitle`, brand logo. Style varies by template preset:
  - `classic` → `hero-image-bg` style (gradient bg, centered text)
  - `modern` → `hero-split` style (left-aligned text, accent bar, dark bg)
  - `elegant` → centered with serif feel, gold accent
  - `bold` → full-width vivid colors, large text
  - `minimal` → clean white bg, minimal text
- **About**: `about_text` → about-centered section (if text exists)
- **Properties**: property_list element with `columns: 3, source: 'featured'`
- **Contact**: contact_form + contact info from `contact_phone`, `contact_email`, `whatsapp_number`
- **CTA**: cta-banner with theme primary color
- **Footer**: org name, tagline, contact info, whatsapp button
- **Theme**: `primaryColor`, `secondaryColor`, `accentColor`, `fontFamily` from brand
- **Meta**: `meta_title`, `meta_description` with fallback to org name

Each template preset adjusts colors, padding, background styles, and layout proportions to match the legacy template's visual identity.

### 2. Migration RPC: `dev_save_draft_v2` (migration)

```sql
CREATE OR REPLACE FUNCTION public.dev_save_draft_v2(p_org_id uuid, p_layout jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE site_documents SET draft_v2 = p_layout WHERE organization_id = p_org_id;
$$;

CREATE OR REPLACE FUNCTION public.dev_set_editor_mode(p_org_id uuid, p_mode text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE site_documents SET editor_mode = p_mode WHERE organization_id = p_org_id;
$$;
```

These are DEV-only RPCs (can be dropped later). `dev_force_publish_v2` already exists.

### 3. Migration page: `src/pages/DevMigrateSiteV2.tsx` (new)

**Route**: `/dev/migrate-site-v2?orgId=...`

**Layout**:
- Top: DEV info panel showing org state (orgId, editor_mode, has draft v1/v2, has published v1/v2, current template, meta fields)
- Middle: Side-by-side preview
  - Left column: Legacy template rendered via `StorefrontTemplateRenderer` (same component used in production)
  - Right column: V2 preview via `SiteDocumentRendererV2` (using the converted/existing draft_v2)
- Bottom: Action buttons

**Data fetching** (all public, no auth needed):
- `get_public_org_by_id` → org
- `get_public_brand_settings` → brand
- `website_settings` select → website (already public via RPC or direct)
- `useSiteDocumentPublic` → siteDoc (editor_mode, layout)
- `marketplace_properties_public` → properties
- Direct query to check `draft_v2 IS NOT NULL` and `published_v2 IS NOT NULL` status

**Actions** (each with confirmation dialog):
1. **"Gerar draft_v2 a partir do legado"**: Calls `convertLegacyToSiteLayoutV2(...)`, then `dev_save_draft_v2` RPC. Disabled if no website_settings exist.
2. **"Sobrescrever draft_v2"**: Same as above but with extra "Are you sure?" confirmation (when draft_v2 already exists).
3. **"Copiar draft_v2 para published_v2"**: Calls existing `dev_force_publish_v2` RPC.
4. **"Ativar modo advanced"**: Calls `dev_set_editor_mode(orgId, 'advanced')`.
5. **"Voltar para simple"**: Calls `dev_set_editor_mode(orgId, 'simple')`.

After each action, invalidate relevant queries so UI refreshes.

### 4. Route registration in `App.tsx`

Add lazy import + route for `/dev/migrate-site-v2`.

### 5. No production changes

No changes to Storefront.tsx, SiteBuilderPro.tsx, or any legacy template. The converter is a standalone lib function. The page is DEV-only.

## Files

| File | Action |
|------|--------|
| `src/lib/convertLegacyToSiteLayoutV2.ts` | Create — conversion helper with 5 template presets |
| `src/pages/DevMigrateSiteV2.tsx` | Create — migration admin page with side-by-side preview |
| `src/App.tsx` | Update — add route |
| Migration SQL | Create `dev_save_draft_v2` + `dev_set_editor_mode` RPCs |

## Validation

After implementation, navigate to `/dev/migrate-site-v2?orgId=cdf3f0e6-da64-4090-bc76-1758796bea28` and execute the 10-step validation sequence from the requirements.

