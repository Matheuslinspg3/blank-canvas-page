

## Problem

The `manage-custom-domain` Edge Function is returning **502** errors. Based on the Sentry breadcrumbs (response body size 106 bytes), the function IS executing but the **Cloudflare API call is failing** and the function returns 502 at line 124 or 174.

Two issues found:

1. **Missing `config.toml` entry**: `manage-custom-domain` is NOT listed in `supabase/config.toml`, meaning it defaults to `verify_jwt = true`. While the function does its own auth, adding it explicitly with `verify_jwt = false` ensures consistency with the project pattern and avoids potential gateway-level JWT issues.

2. **Poor error logging**: When Cloudflare returns an error, the function logs it but the response body doesn't include enough detail for debugging. The `corsHeaders` are also missing `Content-Type` in some response paths.

## Plan

### 1. Add `manage-custom-domain` to `config.toml`

Add `verify_jwt = false` entry so the function handles its own auth (matching the project pattern for all other functions).

### 2. Improve error handling in the Edge Function

- Add `Content-Type: application/json` header to ALL responses (some paths are missing it)
- Log the full Cloudflare response status and body when it fails
- Add a guard for undefined `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID` before making API calls (return 500 with clear message instead of crashing)
- Wrap the `req.json()` call to handle cases where the body is empty or invalid

### 3. Redeploy the function

Deploy the updated function to apply the fixes.

## Technical Details

- The Sentry trace confirms the function returns 502 (not a boot crash), meaning auth succeeds but the Cloudflare API call fails
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` secrets exist but may have incorrect values
- Adding the config.toml entry and better logging will help diagnose whether it's a token permission issue, wrong zone ID, or hostname conflict in Cloudflare

