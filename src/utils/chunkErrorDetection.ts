/**
 * Detects errors caused by failed dynamic imports / stale chunks.
 * Common after a deploy invalidates hashed asset filenames.
 */
const CHUNK_ERROR_PATTERNS = [
  /Importing a module script failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Unable to preload CSS/i,
  /ChunkLoadError/i,
  /Loading chunk \d+ failed/i,
  /Loading CSS chunk/i,
  // Guard message from lazyWithRetry when a failed preload resolves a module
  // without its default export (stale chunk). Covers both phrasings. (#49)
  /resolved without (?:a )?default export/i,
  // Server returned HTML (SPA fallback) instead of JS — Safari/Chrome variants
  /Unexpected token '<'/i,
  /expected expression, got '<'/i,
];

/**
 * Patterns for the "module resolved to undefined" failure mode.
 *
 * In some browsers (notably Firefox) a failed `__vite_preload` does NOT reject
 * the dynamic import — it resolves with `undefined`. The `.then(m => m.Export)`
 * callback then throws a generic TypeError accessing a property on undefined,
 * e.g. Firefox: `can't access property "PropertyForm", a is undefined`
 *      Chromium: `Cannot read properties of undefined (reading 'PropertyForm')`
 *
 * These escape the chunk-error patterns above and were NOT being retried /
 * auto-reloaded (Sentry JAVASCRIPT-REACT-47). We only treat them as chunk
 * errors INSIDE the dynamic-import retry wrapper (lazyWithRetry), where the
 * catch scope guarantees the error came from a module load — so matching here
 * does not misclassify unrelated app-logic TypeErrors.
 */
const MODULE_UNDEFINED_PATTERNS = [
  // Firefox: can't access property "X", a is undefined
  /can't access property "[^"]+", \w+ is undefined/i,
  // Chromium: Cannot read properties of undefined (reading 'X')
  /Cannot read propert(?:y|ies) of undefined \(reading '[^']+'\)/i,
  // Older Chromium: Cannot read property 'X' of undefined
  /Cannot read property '[^']+' of undefined/i,
  // Safari: undefined is not an object (evaluating 'a.X')
  /undefined is not an object \(evaluating '[^']+'\)/i,
];

function messageOf(error: unknown): string {
  return typeof error === "string"
    ? error
    : error instanceof Error
      ? `${error.name}: ${error.message}`
      : String((error as any)?.message ?? error);
}

export function isImportChunkError(error: unknown): boolean {
  if (!error) return false;
  const message = messageOf(error);
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(message));
}

/**
 * True when the error looks like a dynamic import that resolved to `undefined`
 * (failed preload that did not reject). MUST only be used in a dynamic-import
 * context (e.g. lazyWithRetry's catch), never as a global error classifier.
 */
export function isModuleUndefinedError(error: unknown): boolean {
  if (!error) return false;
  const message = messageOf(error);
  return MODULE_UNDEFINED_PATTERNS.some((re) => re.test(message));
}

/** True when the error looks like the server returned HTML for a JS asset (MIME mismatch / SPA fallback). */
export function isMimeMismatchError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error ? error.message : String((error as any)?.message ?? error);
  return /Unexpected token '<'|expected expression, got '<'/i.test(message);
}
