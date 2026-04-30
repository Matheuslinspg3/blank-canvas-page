import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import { normalizeError, isExpectedBusinessError } from "@/lib/normalizeError";

// PERF: gcTime 10min, staleTime 2min, retry with exponential backoff for resilience
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (auth, not found, etc.)
        const msg = (error as any)?.message || '';
        if (msg.includes('401') || msg.includes('403') || msg.includes('404')) return false;
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
    mutations: {
      // NEVER retry mutations blindly — retrying inserts caused duplicate
      // submissions and 23505 unique-violation collisions in production.
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      const norm = normalizeError(error);
      if (isExpectedBusinessError(norm)) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      Sentry.captureException(norm, {
        tags: {
          source: 'react-query',
          queryKey: JSON.stringify(query.queryKey).slice(0, 200),
          pg_code: norm.code,
        },
        extra: { details: norm.details, hint: norm.hint },
      });
    },
  }),
  mutationCache: new MutationCache({
    // Single source of truth for mutation error reporting (avoids duplicate Sentry events).
    onError: (error, _vars, _ctx, mutation) => {
      const norm = normalizeError(error);
      if (isExpectedBusinessError(norm)) return;
      Sentry.captureException(norm, {
        tags: {
          source: 'react-query-mutation',
          mutation_key: JSON.stringify(mutation.options.mutationKey ?? []).slice(0, 100),
          pg_code: norm.code,
          pg_constraint: norm.constraint ?? undefined,
        },
        extra: { details: norm.details, hint: norm.hint },
      });
    },
  }),
});
