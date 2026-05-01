/**
 * Backward-compatible shim — delegates to the hardened `lazyWithRetry`.
 * Supports both legacy `lazyRetry(fn, retries?)` and modern
 * `lazyRetry(fn, { moduleName, retries? })` signatures.
 */
import { lazyWithRetry } from "./lazyWithRetry";

interface LazyRetryOptions {
  retries?: number;
  moduleName?: string;
}

export function lazyRetry<T extends { default: React.ComponentType<any> }>(
  importFn: () => Promise<T>,
  optionsOrRetries: number | LazyRetryOptions = {},
): Promise<T> {
  const options: LazyRetryOptions =
    typeof optionsOrRetries === "number"
      ? { retries: optionsOrRetries }
      : optionsOrRetries;
  return lazyWithRetry(importFn, options);
}
