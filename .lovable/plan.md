

## Problem
When a new organization slug is created/updated, there's no automatic DNS record in Cloudflare for the subdomain (`{slug}.portadocorretor.com.br`). Currently this requires manual wildcard CNAME setup. With the new DNS Edit permission on the token, we can automate this.

## Approach
Instead of creating individual DNS records per slug (which doesn't scale and clutters the zone), the best approach is to **create a single wildcard CNAME record** (`*.portadocorretor.com.br → portadocorretor.com.br`) once, which covers all current and future subdomains automatically.

We'll add a new action `ensure_wildcard_dns` to the existing `manage-custom-domain` Edge Function that:
1. Checks if a `*` CNAME record already exists in the zone
2. If not, creates it pointing to `portadocorretor.com.br` (proxied)
3. If it exists, returns success without duplicating

Additionally, we'll call this automatically during `update_slug` so that whenever a slug is saved, the wildcard DNS is guaranteed to exist.

## Changes

### 1. Update `manage-custom-domain` Edge Function
Add `ensure_wildcard_dns` action:
- `GET /zones/{zone}/dns_records?type=CNAME&name=*.portadocorretor.com.br` to check existence
- If missing, `POST /zones/{zone}/dns_records` with `{ type: "CNAME", name: "*", content: "portadocorretor.com.br", proxied: true }`
- Auto-invoke this logic inside the `update_slug` action after successful slug update

### 2. Add UI trigger (optional)
Add a button in `SiteSettingsTab` or call automatically when the site is first activated, so admins can manually trigger if needed.

## Technical Details
- The wildcard CNAME is a single record that routes ALL `*.portadocorretor.com.br` subdomains — no per-slug records needed
- Cloudflare proxied mode ensures DDoS protection and SSL termination
- The function checks for existing records first to be idempotent (safe to call multiple times)
- The `update_slug` action will silently ensure the wildcard exists as a side effect

