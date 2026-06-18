import * as Sentry from "@sentry/react";
import { isImportChunkError, isMimeMismatchError, isModuleUndefinedError } from "./chunkErrorDetection";
import { safeReloadOnce } from "./safeReload";
import { APP_VERSION } from "@/config/appVersion";
import {
  isPreviewHost,
  isInIframe,
  isPwaRuntimeEnabled,
  getServiceWorkerControllerState,
} from "./runtimeEnvironment";

function extractChunkUrl(err: unknown): string | null {
  try {
    const msg = err instanceof Error ? err.message : String((err as any)?.message ?? err);
    const m = msg.match(/\/assets\/[^\s"']+\.(?:js|css|mjs)/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

/**
 * Wraps a dynamic import with retry + safe reload on stale-chunk errors.
 * Use as: lazy(() => lazyWithRetry(() => import("./Foo"), { moduleName: "Foo" }))
 *
 * - Retries up to `retries` times with exponential-ish backoff (300ms, 800ms).
 * - Validates the resolved module has a `default` export — surfaces a clear
 *   error instead of the cryptic `Cannot read properties of undefined (reading 'default')`.
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
    importFn()
      .then((mod) => {
        if (!mod || typeof mod !== "object" || !("default" in mod) || !(mod as any).default) {
          // A failed preload can resolve the import with an incomplete module
          // (no `default`) instead of rejecting — Firefox/Chromium stale-chunk
          // behaviour. Flag this as a chunk-load failure BY CONSTRUCTION so the
          // catch below retries + reloads, instead of letting the bespoke message
          // ("resolved without a default export") escape the string detectors. (#49)
          const err = new Error(
            `Module "${moduleName ?? "unknown"}" resolved without a default export`,
          );
          (err as any).isChunkLoadError = true;
          throw err;
        }
        return mod;
      })
      .catch((error: unknown) => {
        // Within this catch the error always originates from the dynamic import,
        // so a "module resolved to undefined" TypeError (failed preload that did
        // not reject — Firefox/Chromium) is also a stale-chunk failure. (#47)
        const isChunkErr =
          (error as any)?.isChunkLoadError === true ||
          isImportChunkError(error) ||
          isModuleUndefinedError(error);

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
            hostname: typeof window !== "undefined" ? window.location.hostname : "unknown",
            is_preview_host: String(isPreviewHost),
            is_iframe: String(isInIframe),
            pwa_runtime_enabled: String(isPwaRuntimeEnabled),
            sw_controller: getServiceWorkerControllerState(),
            route: typeof window !== "undefined" ? window.location.pathname : "unknown",
            release: APP_VERSION,
          },
          extra: {
            retry_attempt: n,
            chunk_url: extractChunkUrl(error),
          },
          contexts: {
            runtime: {
              online: typeof navigator !== "undefined" ? navigator.onLine : null,
              visibility: typeof document !== "undefined" ? document.visibilityState : null,
              connection:
                typeof navigator !== "undefined"
                  ? (navigator as any).connection?.effectiveType ?? "unknown"
                  : "unknown",
            },
          },
        });

        if (isChunkErr) {
          const reloaded = safeReloadOnce(`lazyWithRetry:${moduleName ?? "unknown"}`);
          if (reloaded) {
            // Suppress fallback flash before reload kicks in.
            return new Promise<T>(() => {});
          }
        }

        throw error;
      });

  return attempt(0);
}

// Re-export for convenience
export { isImportChunkError, isMimeMismatchError, isModuleUndefinedError } from "./chunkErrorDetection";
export { safeReloadOnce, hasReloadedThisSession } from "./safeReload";
