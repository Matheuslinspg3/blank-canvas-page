

## Problem

Two edge functions are using `authClient.auth.getClaims(token)`, which is **not a standard method** in the Supabase JS client library. This causes them to crash with 401 errors.

**Affected functions:**
1. `manage-custom-domain/index.ts` (line 26 uses `getUser()` in current code, but may not be deployed)
2. `generate-landing-content/index.ts` (line 49 still uses `getClaims(token)`)

The landing page at `/imovel/:id` calls `generate-landing-content` to generate AI content. When this edge function crashes, the page still renders but without AI-generated headlines/descriptions. However, the 401 error is also preventing domain management from working.

Additionally, the `generate-landing-content` function requires authentication, but the property landing page is **public** — unauthenticated visitors can't generate new content. The function should:
- Serve cached content without auth (already handled client-side via direct DB read)
- Only require auth for content **generation**

## Plan

### 1. Fix `generate-landing-content` auth (replace `getClaims`)

**File:** `supabase/functions/generate-landing-content/index.ts`

Replace `getClaims(token)` with `getUser()` using a user-context client:

```typescript
const authClient = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { Authorization: authHeader } },
});
const { data: { user }, error: userErr } = await authClient.auth.getUser();
if (userErr || !user) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, ... });
}
// Use user.id instead of claimsData.claims.sub
```

Update the `checkAiRateLimitRedis` call and `ai-router` call to use `user.id` instead of `claimsData.claims.sub`.

### 2. Redeploy `manage-custom-domain`

Ensure the current code (which already uses `getUser()`) is properly deployed. The import path also needs to be checked — it uses `https://esm.sh/@supabase/supabase-js@2.49.4` while other functions use `npm:@supabase/supabase-js@2`. Standardize to `npm:` format.

### 3. Redeploy both edge functions

Trigger redeployment of both functions to ensure the latest code is live.

## Technical Details

- `getClaims()` was never a public API method in `@supabase/supabase-js` v2
- `getUser()` validates the JWT against the Supabase Auth server and returns user data
- The user-context client pattern (passing `Authorization` header to `createClient`) is the correct approach for edge functions

