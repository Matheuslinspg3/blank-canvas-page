import * as Sentry from "@sentry/react";
import { isImportChunkError, isMimeMismatchError } from "./chunkErrorDetection";
import { safeReloadOnce } from "./safeReload";

/**
 * Wraps a dynamic import with retry + safe reload on stale-chunk errors.
 * Use as: lazy(() => lazyWithRetry(() => import("./Foo")))
 *
 * - Retries up to `retries` times with exponential-ish backoff (300ms, 800ms).
 * - On final failure, if it looks like a chunk-load error, triggers ONE
 *   controlled page reload via safeReloadOnce (anti-loop protected).
 * - Reports rich context to Sentry.
 */
export function lazyWithRetry<T extends { default: React.ComponentType<any> }>(
  importFn: () => Promise<T>,
  options: { retries?: number; moduleName?: string } = {},
): Promise<T> {
  const { retries = 2, moduleName } = options;
  const delays = [300, 800];

  const attempt = (n: number): Promise<T> =>
    importFn().catch((error: unknown) => {
      const isChunkErr = isImportChunkError(error);

      if (n < retries && isChunkErr) {
        return new Promise<T>((resolve, reject) => {
          setTimeout(() => attempt(n + 1).then(resolve, reject), delays[n] ?? 800);
        });
      }

      // Final attempt — enrich Sentry and decide on reload.
      Sentry.captureException(error, {
        tags: {
          chunk_error: isChunkErr ? "true" : "false",
          mime_mismatch: isMimeMismatchError(error) ? "true" : "false",
          retries_used: String(n),
          module_name: moduleName ?? "unknown",
        },
        contexts: {
          runtime: {
            online: navigator.onLine,
            visibility: document.visibilityState,
            connection: (navigator as any).connection?.effectiveType ?? "unknown",
            sw_controller: !!navigator.serviceWorker?.controller,
            route: window.location.pathname,
          },
        },
      });

      if (isChunkErr) {
        const reloaded = safeReloadOnce(`lazyWithRetry:${moduleName ?? "unknown"}`);
        if (reloaded) {
          // Return a never-resolving promise to suppress fallback flash before reload kicks in.
          return new Promise<T>(() => {});
        }
      }

      throw error;
    });

  return attempt(0);
}

// Re-export for convenience
export { isImportChunkError, isMimeMismatchError } from "./chunkErrorDetection";
export { safeReloadOnce, hasReloadedThisSession } from "./safeReload";
