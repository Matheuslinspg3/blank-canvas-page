import * as Sentry from "@sentry/react";

/**
 * Capture an exception in Sentry with contextual tags.
 * Safe to call even if Sentry DSN is not configured (no-ops gracefully).
 */
export function captureError(
  error: unknown,
  context?: {
    hook?: string;
    action?: string;
    functionName?: string;
    extra?: Record<string, unknown>;
  },
) {
  Sentry.captureException(error, {
    tags: {
      ...(context?.hook && { hook: context.hook }),
      ...(context?.action && { action: context.action }),
      ...(context?.functionName && { edgeFunction: context.functionName }),
    },
    extra: context?.extra,
  });
}
