/**
 * Backward-compatible shim — delegates to the hardened `lazyWithRetry`.
 * Existing callers (`lazyRetry(() => import(...))`) keep working.
 */
import { lazyWithRetry } from "./lazyWithRetry";

export function lazyRetry<T extends { default: React.ComponentType<any> }>(
  importFn: () => Promise<T>,
  retries = 2,
): Promise<T> {
  return lazyWithRetry(importFn, { retries });
}
