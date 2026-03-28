/**
 * Wraps a dynamic import with retry logic to handle stale chunk errors
 * (e.g. after a new deployment when old hashed filenames no longer exist).
 */
export function lazyRetry<T extends { default: React.ComponentType<any> }>(
  importFn: () => Promise<T>,
  retries = 2
): Promise<T> {
  return new Promise((resolve, reject) => {
    importFn()
      .then(resolve)
      .catch((error: Error) => {
        if (retries > 0 && error.message.includes("dynamically imported module")) {
          // Force a cache-busting reload on the last retry
          if (retries === 1) {
            window.location.reload();
            return;
          }
          setTimeout(() => {
            lazyRetry(importFn, retries - 1).then(resolve, reject);
          }, 500);
        } else {
          reject(error);
        }
      });
  });
}
