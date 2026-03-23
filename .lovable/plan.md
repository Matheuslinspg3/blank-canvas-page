

## Plan: OG Metadata Fallback + Marketplace Desync Warning

### Correction 1 — Edge Function `og-metadata` fallback to `properties`

**File**: `supabase/functions/og-metadata/index.ts`

After each `marketplace_properties` query that returns `null`, add a fallback query to the `properties` table with a JOIN on `property_images` to get the cover image (or first available).

Logic change in the handler (lines 99-123):
- If `propertyId` lookup in `marketplace_properties` returns null → query `properties` by id, then query `property_images` for cover image
- If `orgSlug + code` lookup returns null → query `properties` by `organization_id` + `property_code`, same image fallback
- Extract image from `property_images` (prefer `is_cover = true`, fallback to first by `display_order`)
- The client is already using `SUPABASE_SERVICE_ROLE_KEY` so RLS is bypassed

### Correction 2 — Marketplace desync warning in `PropertyDetails.tsx`

**File**: `src/pages/PropertyDetails.tsx`

Add a query to check if the property is published in `marketplace_properties` and if its `updated_at` is stale compared to the property's own `updated_at`.

Changes:
1. Add a new `useQuery` (after line 150) that fetches `marketplace_properties.updated_at` for the current property id
2. Compare with `property.updated_at` — if marketplace version is older, set a flag
3. In the sidebar Actions card (after line 714), render a clickable warning alert:
   - Yellow `Alert` with text "⚠ Marketplace desatualizado — republicar para sincronizar"
   - On click, call `publishToMarketplace(id)` directly
4. Import `Alert` and `AlertTriangle` icon

### Files Modified (2)
1. `supabase/functions/og-metadata/index.ts`
2. `src/pages/PropertyDetails.tsx`

