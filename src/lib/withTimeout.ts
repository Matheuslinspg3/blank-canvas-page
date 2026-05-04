/**
 * Race a promise against a timeout. If the promise doesn't settle within
 * `ms` milliseconds, rejects with a TimeoutError. Used to prevent the public
 * storefront from hanging forever on slow Supabase RPCs.
 */
export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`Timeout after ${ms}ms: ${label}`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label = "operation"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}
