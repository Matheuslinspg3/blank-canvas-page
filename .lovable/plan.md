

## Plan: Fix All Hardcoded URLs

### Summary
9 corrections across 10 files, replacing hardcoded domain references with environment variables or dynamic values.

### Changes

**1. `src/main.tsx`** — Remove the `habitae1.lovable.app` redirect block (lines 83-94). Keep only the `else` body (SW setup + React render).

**2. `src/pages/Settings.tsx`** (line 876) — Replace `https://habitae1.lovable.app/configuracoes` with `${window.location.origin}/configuracoes`.

**3. `supabase/functions/send-push/index.ts`** (line 90) — Change fallback from `"https://habitae1.lovable.app"` to `"https://portadocorretor.com.br"`.

**4. `supabase/functions/meta-oauth-callback/index.ts`** (line 193) — Change fallback from `"https://habitae1.lovable.app"` to `"https://portadocorretor.com.br"`.

**5. `supabase/functions/rd-station-oauth-callback/index.ts`** (line 105) — Change fallback from `"https://habitae1.lovable.app"` to `"https://portadocorretor.com.br"`.

**6. `supabase/functions/og-metadata/index.ts`** (line 12) — Replace `const SITE_URL = "https://portadocorretor.com.br"` with `const SITE_URL = Deno.env.get("APP_URL") || "https://portadocorretor.com.br"`.

**7. `supabase/functions/ticket-chat/index.ts`** (line 9) — Replace hardcoded URL with `Deno.env.get("N8N_TICKET_WEBHOOK_URL") || "https://n8n.costazul.shop/webhook/lovableportadocorrerora"`.

**8. `supabase/functions/verify-creci/index.ts`** (line 11) — Replace hardcoded URL with `Deno.env.get("N8N_CRECI_WEBHOOK_URL") || "https://n8n.costazul.shop/webhook/verify-creci"`.

**9. Frontend `supabase.co` URL construction** — In 4 files, replace `https://${projectId}.supabase.co/functions/v1/...` with `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/...`:
  - `src/components/ads/MetaSettingsContent.tsx` (line 150)
  - `src/components/ads/MetaConnectionTab.tsx` (line 113)
  - `src/pages/Maintenance.tsx` (lines 258, 494)
  - `src/components/developer/SubscriptionsTab.tsx` (lines 44, 68)

**Note**: `SupportTicketDialog.tsx` references an external Supabase project (`kanrkkvzjbznytensgst`) — this is intentional (external ticketing system) and will NOT be changed.

### Files Modified (10 total)
1. `src/main.tsx`
2. `src/pages/Settings.tsx`
3. `src/pages/Maintenance.tsx`
4. `src/components/ads/MetaSettingsContent.tsx`
5. `src/components/ads/MetaConnectionTab.tsx`
6. `src/components/developer/SubscriptionsTab.tsx`
7. `supabase/functions/send-push/index.ts`
8. `supabase/functions/meta-oauth-callback/index.ts`
9. `supabase/functions/rd-station-oauth-callback/index.ts`
10. `supabase/functions/og-metadata/index.ts`
11. `supabase/functions/ticket-chat/index.ts`
12. `supabase/functions/verify-creci/index.ts`

