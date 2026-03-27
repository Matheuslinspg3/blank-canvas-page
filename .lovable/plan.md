

# Bug Fix: Property data and images lost on edit

## Root Cause

Two separate issues cause data loss when editing a property:

### Issue 1: Image metadata stripped on edit

In `PropertyForm.tsx` (lines 187-189), when loading images for editing, the component fetches R2 metadata fields (`r2_key_full`, `r2_key_thumb`, `storage_provider`, `cached_thumbnail_url`) but **discards them** in the map:

```typescript
// Current — only keeps id, url, is_cover, display_order
allImages = (imgRows || []).map((img: any) => ({
  id: img.id, url: img.url, is_cover: img.is_cover || false, display_order: img.display_order || 0,
}));
```

Then in `usePropertyCRUD.ts`, `updateProperty` **deletes ALL images** and re-inserts them. Since the metadata was stripped, re-inserted images lose `storage_provider`, `r2_key_full`, `r2_key_thumb`, and `phash`. This breaks `getImageUrl()` which relies on `storage_provider === 'r2'` to resolve URLs correctly.

### Issue 2: PropertyImage interface too narrow

The `PropertyImage` interface in `PropertyForm.tsx` (line 86-92) doesn't include R2/storage fields, so even if the data were mapped, TypeScript would strip them.

## Fix

### File 1: `src/components/properties/PropertyForm.tsx`

1. Expand `PropertyImage` interface to include storage metadata fields:
   - `phash`, `r2_key_full`, `r2_key_thumb`, `storage_provider`, `cached_thumbnail_url`

2. Fix `loadPropertyData` image mapping (line 187-189) to preserve ALL fetched fields:
   ```typescript
   allImages = (imgRows || []).map((img: any) => ({
     id: img.id, url: img.url, is_cover: img.is_cover || false,
     display_order: img.display_order || 0,
     phash: img.phash || undefined,
     r2_key_full: img.r2_key_full || undefined,
     r2_key_thumb: img.r2_key_thumb || undefined,
     storage_provider: img.storage_provider || undefined,
     cached_thumbnail_url: img.cached_thumbnail_url || undefined,
   }));
   ```

3. Also add `phash` to the image select query (currently missing).

### File 2: No changes needed to `usePropertyCRUD.ts`

The `ImageData` interface and `updateProperty` already handle all metadata fields correctly. The bug is purely in PropertyForm stripping the data before passing it.

## Impact

- Fixes cover photo disappearing on edit
- Fixes all R2-hosted images breaking after any property edit  
- Fixes image metadata (phash for dedup, storage_provider for URL resolution) being permanently lost
- No schema or migration changes needed

