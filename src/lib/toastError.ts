import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import * as Sentry from "@sentry/react";

/**
 * Generate a short, human-readable error ID (e.g. "ERR-A3F2").
 * Uses 4 hex chars from crypto for uniqueness within a support session.
 */
function generateErrorId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(2)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `ERR-${hex}`;
}

interface ToastErrorOptions {
  /** Context shown as subtitle in the toast */
  description?: string;
  /** Module/hook where the error originated */
  module?: string;
  /** Whether this is a transient/retryable error */
  retryable?: boolean;
  /** Extra metadata sent to Sentry */
  extra?: Record<string, unknown>;
  /** Duration in ms (default 6000) */
  duration?: number;
}

/**
 * Wrapper around `toast.error` that:
 * 1. Generates a short Error ID (ERR-XXXX)
 * 2. Shows user-friendly message + Error ID in the toast
 * 3. Sends a breadcrumb + exception to Sentry with full context
 * 4. Logs to console in dev mode
 *
 * Usage:
 *   toastError("Erro ao salvar imóvel", error, { module: "useProperties" });
 *   toastError("Falha no upload", error);
 */
export function toastError(
  userMessage: string,
  error?: unknown,
  options?: ToastErrorOptions,
): string {
  const errorId = generateErrorId();
  const description = options?.description
    || (options?.retryable ? "Tente novamente em alguns instantes" : undefined);

  // Show toast with Error ID in the description
  toast.error(userMessage, {
    description: description
      ? `${description} · Ref: ${errorId}`
      : `Ref: ${errorId}`,
    duration: options?.duration ?? 6000,
  });

  // Sentry breadcrumb for correlation
  Sentry.addBreadcrumb({
    category: "toast.error",
    message: userMessage,
    level: "error",
    data: {
      errorId,
      module: options?.module,
      retryable: options?.retryable,
      ...options?.extra,
    },
  });

  // Capture exception if an error object was provided
  if (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    Sentry.captureException(err, {
      tags: {
        errorId,
        ...(options?.module && { module: options.module }),
      },
      extra: {
        userMessage,
        retryable: options?.retryable,
        ...options?.extra,
      },
    });
  }

  // Dev-mode console log for easier debugging
  if (import.meta.env.DEV) {
    console.error(`[${errorId}] ${userMessage}`, error, options);
  }

  return errorId;
}
