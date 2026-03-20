

# Plan: Resolve All Audited Migration Errors

## Overview

Based on the 5 audit reports, there are actionable fixes split into two categories: **database fixes** (migrations/inserts) and **secrets/dashboard config** (manual). This plan covers everything fixable from Lovable.

## Fixes to Apply

### 1. Enable 8 disabled triggers on `properties` (Migration)
All 8 custom triggers are confirmed disabled (`tgenabled=D`). A single migration:
```sql
ALTER TABLE properties ENABLE TRIGGER ALL;
```

### 2. Fix cron jobs with old anon key (SQL Insert tool)
Both jobs (#7, #8) use the old project's anon key (`aiflmkkjitvssyswdfga`). Unschedule and recreate with the correct key (`zpajuxxsxrwuqregdzjm`).

### 3. Drop or secure `exec_sql` function (Migration)
The function already checks for `service_role`, but it still allows arbitrary SQL execution. Drop it as a safety measure:
```sql
DROP FUNCTION IF EXISTS public.exec_sql(text);
```

### 4. Add DELETE and UPDATE storage policies for `property-images` (Migration)
Currently only SELECT and INSERT policies exist. Add:
- DELETE policy for authenticated users on `property-images` bucket
- UPDATE policy for authenticated users on `property-images` bucket

### 5. Fix `storage_provider` inconsistency (SQL Insert tool)
1,286 images have `storage_provider='cloudinary'` but their URLs point to R2. Update them:
```sql
UPDATE property_images SET storage_provider = 'r2' 
WHERE storage_provider = 'cloudinary' AND (url LIKE '%r2.dev%' OR url LIKE '%r2.cloudflarestorage%');
```

### 6. Seed `subscription_plans` with default plans (SQL Insert tool)
Table is empty. Insert standard plans (Gratuito, Starter, Professional, Enterprise) with reasonable limits based on the schema structure and code usage patterns.

### 7. Seed `admin_allowlist` with primary admin emails (SQL Insert tool)
Table is empty. Insert the primary admin email(s) from `auth.users` (e.g., `portocaicaraimoveis@gmail.com`).

## Items That Require Manual Dashboard Action (Not Code)
These will be documented but cannot be executed from Lovable:
- **~15 secrets** (R2, Resend, OpenAI, OneSignal, Cloudinary, Meta, etc.) — must be added in Supabase Dashboard > Settings > Edge Functions
- **SITE_URL and Redirect URLs** — Dashboard Auth config
- **OAuth callback URL update** — Google Cloud Console
- **Orphan data decision** — business decision (import 4 missing orgs or clean up ~13,500 records)

## Execution Order
1. Migration: Enable triggers + drop exec_sql + add storage policies
2. Insert: Fix cron jobs (unschedule old, schedule new)
3. Insert: Fix storage_provider data
4. Insert: Seed subscription_plans
5. Insert: Seed admin_allowlist
6. Update PARECER_FINAL document with corrected statuses

