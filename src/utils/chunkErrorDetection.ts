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
  // Server returned HTML (SPA fallback) instead of JS — Safari/Chrome variants
  /Unexpected token '<'/i,
  /expected expression, got '<'/i,
];

export function isImportChunkError(error: unknown): boolean {
  if (!error) return false;
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : String((error as any)?.message ?? error);
  return CHUNK_ERROR_PATTERNS.some((re) => re.test(message));
}

/** True when the error looks like the server returned HTML for a JS asset (MIME mismatch / SPA fallback). */
export function isMimeMismatchError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error ? error.message : String((error as any)?.message ?? error);
  return /Unexpected token '<'|expected expression, got '<'/i.test(message);
}
