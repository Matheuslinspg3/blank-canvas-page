

## Plan: 3 Technical Fixes

### 1. Fix PWA `skipWaiting` conflict
**File**: `vite.config.ts` (line 44)
- Change `skipWaiting: true` → `skipWaiting: false`
- Keep `clientsClaim: true`

### 2. Reduce aggressive refetch intervals
**File**: `src/hooks/useAiRouterProviderStats.ts` (lines 107-108)
- Change `refetchInterval: 30 * 1000` → `refetchInterval: 120 * 1000`
- Add `refetchIntervalInBackground: false`

**File**: `src/hooks/useAiRouterStats.ts` (line 120)
- No `refetchInterval` currently set — no change needed here.

### 3. Remove unused `usePerformanceMode` (Option A)
**File**: `src/components/layouts/AppLayout.tsx`
- Remove import of `usePerformanceMode` (line 10)
- Remove call `usePerformanceMode()` (line 21)

**File**: `src/hooks/usePerformanceMode.ts`
- Delete the file (dead code, no other consumers)

### Files Modified (4)
1. `vite.config.ts`
2. `src/hooks/useAiRouterProviderStats.ts`
3. `src/components/layouts/AppLayout.tsx`
4. `src/hooks/usePerformanceMode.ts` (deleted)

