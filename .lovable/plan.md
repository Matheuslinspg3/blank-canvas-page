

# Performance Optimization Plan — Properties Page (`/imoveis`)

## Summary

The Properties page handles ~1,500 properties with ~18,000 images. Several architectural issues cause unnecessary slowness: a missing materialized column, redundant full-dataset fetches, client-side sorting/pagination of large arrays, and correlated subqueries in the RPC. This plan addresses all priority levels systematically.

---

## Current Issues Found

1. **`cover_image_url` column does not exist** on the `properties` table — `usePropertiesList` selects it but always gets `null`, so card images are broken on initial load (without filters). The RPC computes it via a correlated subquery per row.
2. **`usePropertiesList` fetches 500 rows** in one page — no real server-side pagination tied to the UI's `currentPage`/`pageSize`.
3. **`usePropertyCRUD` loads ALL properties with ALL images** when filters are active — heavy join with `property_images` (18k rows).
4. **Client-side sort/paginate** of the full dataset on every filter/sort change.
5. **`search_properties_advanced` RPC** hardcoded `p_limit: 500` from the frontend, no sort parameter, correlated subquery for cover image per row.
6. **Broad invalidations**: mutations invalidate `['properties']` which triggers all query variants.
7. **`filteredProperties` merging** uses `allProperties.find(p => p.id === result.id)` — O(n²) scan.

---

## Phase 1 — Quick Wins

### 1A. Materialize `cover_image_url` on `properties` table

**Migration SQL:**
- Add `cover_image_url TEXT` column to `properties`.
- Create trigger that updates it on `property_images` INSERT/UPDATE/DELETE.
- Backfill existing data.
- Add index: `CREATE INDEX idx_property_images_cover ON property_images (property_id) WHERE is_cover = true`.

**Impact:** Eliminates correlated subquery in both `usePropertiesList` and `search_properties_advanced` RPC.

### 1B. Wire server-side pagination in `usePropertiesList`

**Files:** `src/hooks/usePropertiesList.ts`, `src/pages/Properties.tsx`

- Accept `sortBy` parameter and map to SQL `order()`.
- Use UI's `currentPage` and `pageSize` directly (not hardcoded 500).
- Return `total` for pagination controls.
- Remove client-side sort in `Properties.tsx` when no filters are active.

### 1C. Fix O(n²) merge in `filteredProperties`

**File:** `src/pages/Properties.tsx` (line ~391)

- Build a `Map<string, PropertyWithDetails>` from `allProperties` once, then use `.get()` instead of `.find()`.

### 1D. Add `loading="lazy"` and `decoding="async"` to card images

**Files:** `PropertyCard.tsx`, `PropertyListItem.tsx`

- Ensure all `<img>` tags in cards use `loading="lazy"` and `decoding="async"`.

---

## Phase 2 — Structural Improvements

### 2A. Server-side pagination for advanced search

**Files:** `src/hooks/useAdvancedPropertySearch.ts`, RPC `search_properties_advanced`

- Pass `p_limit` and `p_offset` from the UI's `currentPage`/`pageSize`.
- Add `p_sort_by` parameter to the RPC (values: `recent`, `oldest`, `price_asc`, `price_desc`, `beach_asc`, `beach_desc`).
- Update RPC with dynamic `ORDER BY` using `CASE` expressions.
- Add a companion `search_properties_advanced_count` RPC or modify the existing one to also return total count.
- Remove client-side sort when advanced search is driving the UI.

### 2B. Eliminate `usePropertyCRUD` listing query entirely

**File:** `src/hooks/useProperties.ts`, `src/pages/Properties.tsx`

- The CRUD hook's listing fetches ALL properties + ALL images. It should NOT be used for listing at all — only for mutations.
- Set `enabled: false` on the listing query permanently and use only `usePropertiesList` (no filters) or `useAdvancedPropertySearch` (with filters) for data.
- Keep mutation functions (`createProperty`, `updateProperty`, `deleteProperty`) from the CRUD hook.

### 2C. Targeted cache invalidation

**Files:** `src/hooks/usePropertyCRUD.ts`

- On create/update/delete mutations, invalidate `['properties-list']` and `['properties-advanced-search']` only.
- Remove broad `['properties']` invalidation that triggers the heavy listing query.

### 2D. Debounce search text input

**File:** `src/components/properties/UnifiedPropertySearch.tsx`

- Ensure `onTextSearch` callback is debounced (300ms) to avoid rapid filter changes triggering multiple RPC calls.

---

## Phase 3 — UX Refinements

### 3A. Skeleton loading states

- Already implemented. Validate skeleton count matches column layout.

### 3B. `placeholderData: keepPreviousData`

- Already on `usePropertiesList`. Add to `useAdvancedPropertySearch` so the grid doesn't flash empty during page transitions.

### 3C. Smooth page transitions

- Add `transition-opacity` to the grid container during `isFetching` state (dim but don't remove content).

---

## Database Migrations Required

```sql
-- 1. Add materialized cover_image_url column
ALTER TABLE properties ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- 2. Backfill from property_images
UPDATE properties p
SET cover_image_url = (
  SELECT pi.url FROM property_images pi 
  WHERE pi.property_id = p.id AND pi.is_cover = true 
  ORDER BY pi.display_order LIMIT 1
);

-- 3. Index for cover image lookup
CREATE INDEX IF NOT EXISTS idx_property_images_cover 
ON property_images (property_id) WHERE is_cover = true;

-- 4. Trigger to keep cover_image_url in sync
CREATE OR REPLACE FUNCTION sync_cover_image_url()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_property_id uuid; v_url text;
BEGIN
  v_property_id := COALESCE(NEW.property_id, OLD.property_id);
  SELECT pi.url INTO v_url FROM property_images pi 
  WHERE pi.property_id = v_property_id AND pi.is_cover = true 
  ORDER BY pi.display_order LIMIT 1;
  UPDATE properties SET cover_image_url = v_url WHERE id = v_property_id;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_sync_cover_image
AFTER INSERT OR UPDATE OR DELETE ON property_images
FOR EACH ROW EXECUTE FUNCTION sync_cover_image_url();

-- 5. Update search RPC to use materialized column + add sort + count
-- (Replace correlated subquery with p.cover_image_url)
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/usePropertiesList.ts` | Server-side sort + real pagination params |
| `src/hooks/useAdvancedPropertySearch.ts` | Pagination params, sort, count |
| `src/hooks/usePropertyCRUD.ts` | Disable listing query, targeted invalidation |
| `src/hooks/useProperties.ts` | Pass `enabled: false` to CRUD listing |
| `src/pages/Properties.tsx` | Wire server pagination, remove client sort, fix O(n²), add fetching indicator |
| `src/components/properties/PropertyCard.tsx` | Lazy image loading |
| `src/components/properties/PropertyListItem.tsx` | Lazy image loading |
| Migration SQL | Materialize cover_image_url, trigger, index, RPC update |

---

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Initial query payload | ~500 rows × all fields + 18k image joins | ~50 rows × card fields only |
| Cover image resolution | Correlated subquery per row | Direct column read |
| Sort/paginate | Client-side on full array | Server-side SQL |
| Re-renders on selection | Already memoized (good) | Same |
| Filter search round-trip | 500 results, no pagination | Paginated, sorted server-side |

---

## Risks and Trade-offs

1. **Trigger overhead**: `sync_cover_image_url` fires on every image INSERT/UPDATE/DELETE — acceptable for the write volume of this app.
2. **Sort server-side removes ability to sort without re-fetch** — mitigated by `keepPreviousData` showing stale data while fetching.
3. **Breaking `usePropertyCRUD` listing** — only mutations are used from it; any component still reading `.properties` from it will need to switch to `usePropertiesList`.

---

## Validation Checklist

- [ ] Cards show cover images on initial load (no filters)
- [ ] Pagination controls work correctly (page 1, 2, 3...)
- [ ] Sort by price/date/beach works without client-side reprocessing
- [ ] Filters + search return correct results with pagination
- [ ] Bulk select/delete/inactivate/publish still functional
- [ ] Property create/update/delete invalidates correct queries
- [ ] Map view shows properties correctly
- [ ] PDF import flow unaffected
- [ ] Owner filter still works
- [ ] No regression on property detail navigation

