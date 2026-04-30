
# Fix White-Label Color Propagation

## Problem

The `useWhiteLabel` hook currently only overrides 2 CSS variables (`--primary` and `--accent`) when white-label is active. Several UI elements use hardcoded colors that ignore the brand palette:

1. **Gradient text classes** (`text-gradient-vibrant`, `text-gradient-warm`, etc.) — hardcoded HSL values in `index.css`. Used in WelcomeHeader (greeting name), PropertyLandingPage (prices), Auth pages.
2. **Sidebar active/ring colors** — `--sidebar-primary`, `--sidebar-ring` never overridden, always show default orange.
3. **Focus ring** — `--ring` never overridden.
4. **Secondary color** — `--secondary` never overridden despite being available in the config.

## Changes

### 1. Expand CSS variable overrides in `useWhiteLabel.ts`

When white-label is enabled, also set:
- `--secondary` (from `config.secondaryColor`)
- `--ring` (match accent)
- `--sidebar-primary` (match accent or primary)
- `--sidebar-ring` (match accent)

Clean up all on unmount/disable.

### 2. Make gradient text classes use CSS variables in `index.css`

Update the gradient classes to reference `var(--primary)` and `var(--accent)` instead of hardcoded HSL:

- `.text-gradient-vibrant` — gradient from `hsl(var(--primary))` to `hsl(var(--accent))`
- `.text-gradient-warm` — same approach
- `.text-gradient-primary` — use `--primary` to `--accent`
- `.text-gradient-gold` — use `--accent` range
- `.text-gradient-ocean` — use `--primary` to `--accent`

This way all gradient text automatically adapts when white-label overrides the CSS vars.

### 3. WelcomeHeader — no code change needed

Once gradients use CSS vars, `text-gradient-vibrant` will automatically pick up brand colors. The component already imports `useWhiteLabel` for label text.

### 4. PropertyLandingPage — no code change needed

Same reason: gradient classes will inherit brand colors via CSS vars.

## Technical Details

**File: `src/hooks/useWhiteLabel.ts`** — Add `--secondary`, `--ring`, `--sidebar-primary`, `--sidebar-ring` to the `useEffect` that sets CSS vars.

**File: `src/index.css`** — Rewrite 5 gradient classes to use `var(--primary)` and `var(--accent)` instead of literal HSL values. The default theme vars already contain the same red/orange hues, so non-white-label users see no visual change.

Total: 2 files changed.
