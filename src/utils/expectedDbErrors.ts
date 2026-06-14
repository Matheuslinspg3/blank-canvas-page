/**
 * Detects *expected*, user-actionable validation errors raised by the database
 * (Postgres triggers / RPC `RAISE`) and surfaced to the client as a
 * `PostgrestError`.
 *
 * These are NOT crashes: the UI already shows them via a controlled toast
 * (e.g. the marketplace publish flow in `usePropertyBulkOps`). They must not be
 * captured by Sentry as critical `error` events — otherwise each user that hits
 * a normal validation guard generates noise and false "Regressed" issues.
 *
 * Same convention as `isProductLimitError` (see `src/lib/planLimits.ts`):
 * expected business validation → dropped in Sentry `beforeSend`.
 *
 * Keep this list tight and message-specific so we never swallow genuine,
 * unexpected database failures.
 */
const EXPECTED_DB_VALIDATION_PATTERNS = [
  // REACT-32: publishing to marketplace using the owner's phone requires a
  // primary owner with a valid phone linked to the property. Handled + toasted.
  /vincule um proprietário com telefone válido ao imóvel/i,
  /telefone do proprietário/i,
];

/**
 * True when `error` is an expected, handled database validation that the UI
 * already presents to the user, so Sentry should not record it as `error`.
 *
 * Cross-realm safe via duck typing (does not rely on `instanceof`).
 */
export function isExpectedDbValidationError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const anyErr = error as Record<string, unknown>;
  const name = typeof anyErr.name === "string" ? anyErr.name : "";
  const message = typeof anyErr.message === "string" ? anyErr.message : "";

  // Only consider PostgREST/Supabase-shaped errors to avoid over-matching.
  const looksLikePostgrest =
    name === "PostgrestError" ||
    "code" in anyErr ||
    "details" in anyErr ||
    "hint" in anyErr;

  if (!looksLikePostgrest) return false;

  return EXPECTED_DB_VALIDATION_PATTERNS.some((re) => re.test(message));
}
