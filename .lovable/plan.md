# Fix HTTP 400 in `marketplace-metrics` (Sentry, /crm)

## Root cause

`src/hooks/useMarketplaceMetrics.ts` builds a single `.in("marketplace_property_id", published.map(p => p.id))` filter directly from `marketplace_properties.id`, with no sanitization and no batching. PostgREST returns HTTP 400 when an element is **invalid or empty**, or when the resulting URL grows too long. Duplicates do not by themselves cause 400, but they bloat the URL unnecessarily and contribute to the length problem.

Audit of other `.in(...)` calls in the marketplace surface:
- `useMarketplace.ts:129` — `orgIds` from currently visible properties (≤1000 page rows). Bounded; **leave as-is**.
- `useMarketplace.ts:223` — `typeIds` from distinct property types. Bounded by domain (handful of types); **leave as-is**.
- `usePropertyBulkOps.ts` — already chunks at the caller; **leave as-is**.

If any of these grows past ~100 IDs in production, follow up by reusing the helpers from this PR.

## Files

### 1. `src/lib/uuid.ts` *(new)*

```ts
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isValidUuid(value: unknown): value is string;
export function normalizeUuidList(values: ReadonlyArray<unknown> | null | undefined): string[];
```

`normalizeUuidList`:
- coerces with `String(value).trim().toLowerCase()`
- drops `null` / `undefined` / empty / non-UUID
- dedupes via `Set`
- in DEV only: `console.warn` with the **count** of discarded entries — never the values, never in production

### 2. `src/lib/array.ts` *(new)*

```ts
export function chunk<T>(arr: ReadonlyArray<T>, size: number): T[][];
export function runWithConcurrency<T, R>(
  items: ReadonlyArray<T>,
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]>;
```

`runWithConcurrency`:
- shared cursor (`cursor++` is atomic in JS's single-threaded event loop, no race)
- N runners pull next index until exhausted
- preserves input order in the returned `results[]`
- fails fast on first rejection (Promise.all-like)

### 3. `src/hooks/useMarketplaceMetrics.ts` *(refactor)*

- `validIds = normalizeUuidList(published.map(p => p.id))`.
- If `validIds.length === 0` → skip Supabase entirely, return one entry per published property with `contact_count: 0` and `last_contact_at: null` (preserves the expected shape).
- `batches = chunk(validIds, 100)`.
- `runWithConcurrency(batches, 5, worker)` — bounded parallelism (max 5 in flight).
- Each worker uses the supabase-js builder `.in("marketplace_property_id", batch)` (never manual `in.(...)` strings).
- On batch error throw `Failed marketplace_contact_access batch ${i + 1}/${total}: ${error.message}` — **no IDs in message or logs**.
- Merge all batch rows, then aggregate (count + max `accessed_at`) exactly as today.

### 4. `src/components/marketplace/MarketplaceMetricsCard.tsx` *(error branch)*

- Destructure `isError`, `error` from the hook.
- If `isError` → return `null` so `/crm` keeps rendering normally.
- `console.error` only when `import.meta.env.DEV`.

## Out of scope

- `marketplace_contact_access` schema, RLS, insert paths.
- KanbanBoard, leads RLS, edge functions.
- The bounded `.in()` calls listed in "Root cause".

## Acceptance criteria

- `marketplace-metrics` never sends invalid UUIDs to PostgREST.
- `/crm` renders even if metrics fail (card silently hidden).
- Works with 0, 1, few, or thousands of published properties.
- No single request URL contains thousands of IDs (max 100 per request, max 5 concurrent).
- `npx tsc --noEmit` and `npx vite build` pass.
- No PII / no IDs in error messages or logs (DEV logs only counts).

## Manual test plan on `/crm`

1. **Org with 0 published properties** → page renders, card hidden, **no** request to `marketplace_contact_access`.
2. **Few published properties** → exactly 1 request to `marketplace_contact_access` with ≤100 IDs in `?marketplace_property_id=in.(...)`.
3. **>100 published properties** (seed in dev) → multiple requests, each ≤100 IDs, max 5 concurrent in DevTools Network, page renders normally.
4. **Inject an invalid id** temporarily (e.g. push `"not-a-uuid"` before the sanitizer) → confirm sanitizer drops it, request succeeds, DEV warn shows count only.
5. **Force a Supabase error** (DevTools offline / throttle) → `/crm` still renders, card hidden, `console.error` only in DEV.
6. **Sentry**: confirm no new `Pedido ruim (Bad Request)` events for `marketplace-metrics` after deploy.

## Post-implementation report (will be returned)

1. Files changed.
2. Functions created/changed.
3. Final UUID sanitization behavior.
4. Final batching behavior.
5. Final concurrency-limited execution behavior.
6. `npx tsc --noEmit` and `npx vite build` results.
7. Manual `/crm` test plan (above).
