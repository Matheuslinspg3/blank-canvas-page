

# Plan: FASE F2 — Piloto com 2 orgs + remover confirm() bloqueante

## Data Reality

Only **one org** (`cdf3f0e6...` — Porto Caiçara) has `website_settings` populated. All other orgs have no `website_settings` at all, which means the converter produces a minimal/fallback layout for them.

**Pilot orgs:**
- **Org A** (Porto Caiçara — `cdf3f0e6...`): template `minimal`, rich data (hero, about, contact, meta, brand colors). Already has `draft_v2` and `published_v2` from previous phases. Will reset `published_v2` to null to re-test full flow.
- **Org B** (Teste Corretor — `0d37f6b3...`): No `website_settings`, no `site_documents`, no brand. Tests the "empty org" conversion path — converter should produce a valid seed layout with fallback defaults.

## Changes

### 1. Replace `confirm()` with AlertDialog in `DevMigrateSiteV2.tsx`

Replace all 4 `confirm()` calls with a single reusable `AlertDialog` state pattern:

- State: `pendingAction: { label: string; description: string; onConfirm: () => Promise<void> } | null`
- Each button sets `pendingAction` instead of calling `confirm()`
- An `AlertDialog` at the bottom of the component shows the action details and "Confirmar" / "Cancelar" buttons
- On confirm, execute `pendingAction.onConfirm()` and clear state
- Uses existing `@/components/ui/alert-dialog` (already in the project)

This removes the browser-native `confirm()` blocker while keeping confirmation UX.

### 2. Ensure Org B has a `site_documents` row

The migration page calls `useSiteDocumentPublic` which queries the `site_documents` table. If no row exists, the RPC returns null. The page already handles this gracefully (shows "no layout"). But to test save/publish, we need the row to exist.

The `dev_save_draft_v2` RPC does `UPDATE ... WHERE organization_id = p_org_id`. If no row exists, it updates 0 rows silently. We need to handle this:

- Option: Add an `INSERT ... ON CONFLICT DO NOTHING` to ensure the row exists before updating. Update the `dev_save_draft_v2` RPC via migration to use `INSERT INTO site_documents (organization_id, editor_mode) VALUES (p_org_id, 'simple') ON CONFLICT (organization_id) DO NOTHING;` before the UPDATE.

### 3. Route registration

No changes needed — `/dev/migrate-site-v2` already registered.

### 4. Runtime validation

After code changes, navigate to `/dev/migrate-site-v2` for both orgs and execute the full 11-step flow using browser automation (now possible without `confirm()` blockers).

## Files

| File | Action |
|------|--------|
| `src/pages/DevMigrateSiteV2.tsx` | Update — replace `confirm()` with AlertDialog |
| Migration SQL | Update `dev_save_draft_v2` to upsert `site_documents` row |

## Validation Plan

For each org, automate via browser:
1. Navigate to `/dev/migrate-site-v2?orgId=...`
2. Click "Preview V2 do legado"
3. Click "Salvar como draft_v2" → confirm in AlertDialog
4. Click "Copiar draft → published" → confirm
5. Click "Ativar advanced" → confirm
6. Navigate to `/dev/storefront-v2?orgId=...` → verify renderer v2
7. Return to migrate page → "Voltar simple" → confirm
8. Navigate to storefront v2 → verify fallback
9. Return → reactivate advanced
10. Screenshots at key steps

