

## Plan: Performance Indexes & Ranking Optimization Migration

### Key Findings

- **fn_agent_ranking already uses CTEs** (migration `20260321`). The user's request to rewrite it is already done. The existing version is well-structured and compatible with the frontend (`useDashboardRanking.ts` expects `user_id`, `full_name`, `avatar_url`, `active_leads`, `visits`, `closings`, `interactions`, `avg_response_hours`).
- **`user_roles` has NO `organization_id` column** — the user's proposed SQL incorrectly references `ur.organization_id`. The existing function correctly omits this.
- **`appointments` uses `completed` (boolean)**, not `status = 'completed'` as in user's proposed SQL.
- **None of the proposed indexes exist yet** — all are new.
- **`leads` has no `status` column in the traditional sense** — it uses `is_active` boolean + `lead_stage_id` FK. The index `idx_leads_org_status` would fail. Replace with `idx_leads_org_active`.

### Migration Content

One migration file with:

**1. Dashboard performance indexes (10 indexes)**
- `idx_leads_org_created` on `leads(organization_id, created_at DESC)`
- `idx_leads_org_active` on `leads(organization_id, is_active)` — corrected from user's `status`
- `idx_leads_org_stage` on `leads(organization_id, lead_stage_id)`
- `idx_contracts_org_created` on `contracts(organization_id, created_at DESC)`
- `idx_contracts_org_status` on `contracts(organization_id, status)`
- `idx_appointments_org_start` on `appointments(organization_id, start_time)`
- `idx_lead_interactions_broker_created` on `lead_interactions(created_by, created_at DESC)`
- `idx_lead_interactions_org_created` on `lead_interactions(organization_id, created_at DESC)`
- `idx_transactions_org_created` on `transactions(organization_id, created_at DESC)`
- `idx_properties_org_status` on `properties(organization_id, status)`

**2. fn_agent_ranking — NO CHANGE needed**
The function was already rewritten with CTEs in migration `20260321`. Rewriting it again with the user's proposed SQL would **break it** because:
- `user_roles` has no `organization_id` column
- `appointments` uses `completed` boolean, not `status`
- Return type is `jsonb` (not `RETURNS TABLE`), matching what the frontend expects

**3. Marketplace search indexes (3 items)**
- `CREATE EXTENSION IF NOT EXISTS pg_trgm` (already exists per audit, but IF NOT EXISTS is safe)
- `idx_marketplace_city_trgm` GIN index on `marketplace_properties(address_city)`
- `idx_marketplace_properties_active` composite on `(is_active, transaction_type, price)`

### File Created
- `supabase/migrations/[timestamp]_performance_indexes_and_ranking_optimization.sql`

### Technical Notes
- All indexes use `IF NOT EXISTS` — safe to run even if some already exist
- No function rewrite needed — avoids breaking the working CTE version
- `leads.status` corrected to `leads.is_active` based on actual schema

