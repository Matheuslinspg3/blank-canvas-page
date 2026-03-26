/**
 * Resilient fetch with automatic timeout.
 * Import: import { fetchWithTimeout } from "../_shared/fetch-with-timeout.ts";
 */

export async function fetchWithTimeout(
  url: string | URL,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
