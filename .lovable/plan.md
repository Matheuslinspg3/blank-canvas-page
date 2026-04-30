
# Fix Production Console Issues

## Diagnostic Summary

### 1. Auth Refresh Token (400 / Invalid Refresh Token)
**Root cause**: When the stored refresh token is invalid (e.g. revoked, expired, or used from another tab), Supabase SDK fires `SIGNED_OUT`. Current handling is mostly correct, but:
- `getSession().catch()` doesn't clean up local storage — can leave corrupt session data that causes retry loops.
- No explicit invalidation of React Query cache on sign-out, so stale queries may fire briefly with dead tokens.

**Fix** (in `src/contexts/AuthContext.tsx`):
- In the `.catch()` of `getSession()`: call `supabase.auth.signOut({ scope: 'local' })` to clear storage, reset all state.
- In the `SIGNED_OUT` handler: call `queryClient.clear()` to stop all in-flight queries with stale tokens.
- Export or access `queryClient` from `App.tsx` for this — or pass it via a module-level reference.

### 2. OneSignal Duplicate Initialization
**Root cause**: `usePushNotifications` hook mounts in 3+ places (PushPermissionBanner in AppLayout, Settings page, PushTestCard). Each mount calls `initOneSignal()` + `loginOneSignal()` again. While `initOneSignal` has a singleton guard, `loginOneSignal` doesn't — it calls `OneSignal.login(userId)` every time. The debug logs (`[Push] Inicializando...`, `[Push] SDK pronto...`) fire on every mount.

**Fix** (in `src/hooks/usePushNotifications.ts`):
- Add a module-level `setupDoneForUser` variable tracking the user ID that was last set up.
- Skip the full setup flow if `setupDoneForUser === user.id`.
- Reset on user change/logout.

### 3. Service Worker Message Handler Warning
**Root cause**: The `sw.ts:21` warning indicates a `message` event handler registered inside an async callback or `importScripts`. The OneSignal worker at `public/push/onesignal/OneSignalSDKWorker.js` only has `importScripts(...)` — no custom `message` handler. The warning likely comes from the OneSignal SDK itself registering the handler lazily.

**Verdict**: This is internal to the OneSignal SDK. No fix needed from our side. The warning is benign and can be documented as known.

### 4. Minor Warnings

#### 4a. Password autocomplete attributes
**File**: `src/pages/Auth.tsx`
- Login password input (line ~595): add `autoComplete="current-password"`
- Signup password input (line ~803): add `autoComplete="new-password"`

#### 4b. `mobile-web-app-capable` meta tag
**File**: `index.html`
- Already has `apple-mobile-web-app-capable`. Add `<meta name="mobile-web-app-capable" content="yes" />` right after it.

#### 4c. DialogContent without DialogDescription
**File**: `src/components/ui/dialog.tsx`
- Add a visually-hidden default `DialogDescription` inside `DialogContent` so all 295 usages get aria-describedby automatically without touching each file.
- Use `<DialogPrimitive.Description className="sr-only">Dialog content</DialogPrimitive.Description>` as first child, which consumers can override by providing their own.

### 5. External Scripts Resilience (Clarity, Sentry, Google Ads)
**Findings**:
- **Clarity**: Loaded only after LGPD consent via `loadClarityScript()`. Safe — uses `window.clarity?.()` guards.
- **Sentry**: Loaded via `@sentry/react` import. Standard usage, resilient to network blocks.
- **Google Ads**: Not present in the codebase at all — the blocked `pagead2.googlesyndication.com` is likely from a browser extension or ad injection. No fix needed.
- All external script failures are handled gracefully with optional chaining / try-catch. No functional breakage.

**Verdict**: No changes needed for external scripts.

## Files to Change

1. **`src/contexts/AuthContext.tsx`** — Improve `getSession().catch()` cleanup; invalidate React Query on sign-out
2. **`src/hooks/usePushNotifications.ts`** — Add singleton guard for setup per user ID
3. **`src/pages/Auth.tsx`** — Add `autoComplete` to password inputs
4. **`index.html`** — Add `mobile-web-app-capable` meta tag
5. **`src/components/ui/dialog.tsx`** — Add default hidden DialogDescription

## Testing

1. **Login normal**: should work without extra console logs
2. **Session expired**: manually clear refresh token from localStorage, reload — should redirect to `/auth` with toast, no loop
3. **Navigation between routes**: OneSignal logs should appear only once per session, not on every route change
4. **Dialog warnings**: open any dialog — no more "missing Description" console warning
5. **Password fields**: browser password manager should recognize fields correctly
6. **Blocked external scripts**: app should load normally with ad blockers active
