/**
 * Error normalization helpers.
 *
 * PostgREST/Supabase often throws *plain objects* like
 *   { code: '23505', message: '...', details: null, hint: null }
 * instead of real `Error` instances. When these objects reach Sentry,
 * they appear as "Object captured as exception with keys: code, details,
 * hint, message" — which destroys grouping and observability.
 *
 * `normalizeError` converts any unknown thrown value into a real `Error`
 * carrying business metadata (pg code, constraint, friendly message),
 * which downstream code (toasts, Sentry filters) can rely on.
 */

import { isProductLimitError } from './planLimits';

export interface NormalizedError extends Error {
  code?: string;
  details?: string | null;
  hint?: string | null;
  constraint?: string | null;
  /** Friendly, end-user-facing message (PT-BR). */
  userMessage?: string;
  /** Known business error → safe to filter out / not alert as critical. */
  isExpected?: boolean;
  /** Original raw value (for Sentry extras). */
  raw?: unknown;
}

/** Postgres unique violation. */
export function isUniqueViolation(err: unknown): boolean {
  return getCode(err) === '23505';
}

/** Errors we already handle in UI and don't need to alert in Sentry. */
export function isExpectedBusinessError(err: unknown): boolean {
  // Product/plan limits are always expected business outcomes.
  if (isProductLimitError(err)) return true;
  const code = getCode(err);
  // 23505 = unique_violation, 23503 = fk_violation, 23514 = check_violation
  if (code === '23505') return true;
  // PGRST116 = no rows returned by maybeSingle/single — usually expected
  if (code === 'PGRST116') return true;
  const msg = getMessage(err) || '';
  if (/Limite de \d+ imóveis atingido/i.test(msg)) return true;
  if (/AbortError/i.test(msg)) return true;
  return false;
}

function getCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const c = (err as any).code;
  return typeof c === 'string' ? c : undefined;
}

function getMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && typeof (err as any).message === 'string') {
    return (err as any).message;
  }
  return undefined;
}

/**
 * Extracts a constraint name from a Postgres error message like
 *   `duplicate key value violates unique constraint "properties_org_property_code_key"`
 */
function extractConstraint(message: string | undefined): string | null {
  if (!message) return null;
  const m = message.match(/constraint\s+"([^"]+)"/i);
  return m ? m[1] : null;
}

/** Map a (code, constraint) pair to a friendly PT-BR message. */
function friendlyMessage(code: string | undefined, constraint: string | null, fallback: string): string {
  if (code === '23505') {
    switch (constraint) {
      case 'properties_org_property_code_key':
        return 'O código do imóvel colidiu com outro recente. Tente salvar novamente — vamos gerar um novo código automaticamente.';
      case 'properties_pkey':
        return 'Este imóvel já foi cadastrado.';
      default:
        return 'Já existe um registro com estes dados nesta organização.';
    }
  }
  if (code === '23503') return 'Operação inválida: existe uma referência relacionada que impede esta ação.';
  if (code === '23514') return 'Os dados informados não atendem às regras de validação.';
  if (code === 'PGRST301' || code === 'PGRST116') return 'Registro não encontrado.';
  return fallback;
}

export function normalizeError(raw: unknown): NormalizedError {
  // Already a normalized error → return as-is
  if (raw instanceof Error && (raw as NormalizedError).code !== undefined) {
    return raw as NormalizedError;
  }

  // Already a real Error (just wrap/tag it)
  if (raw instanceof Error) {
    const constraint = extractConstraint(raw.message);
    const code = (raw as any).code;
    const err = raw as NormalizedError;
    if (constraint) err.constraint = constraint;
    if (code) err.code = code;
    err.userMessage = friendlyMessage(code, constraint, raw.message);
    err.isExpected = isExpectedBusinessError(raw);
    err.raw = raw;
    return err;
  }

  // Plain object thrown (typical PostgREST / Supabase shape)
  const message = getMessage(raw) || 'Ocorreu um erro inesperado.';
  const code = getCode(raw);
  const constraint =
    (raw && typeof raw === 'object' && typeof (raw as any).constraint === 'string'
      ? (raw as any).constraint
      : null) ?? extractConstraint(message);

  const err = new Error(message) as NormalizedError;
  err.name = code ? 'PostgrestError' : 'AppError';
  err.code = code;
  err.details = (raw as any)?.details ?? null;
  err.hint = (raw as any)?.hint ?? null;
  err.constraint = constraint;
  err.userMessage = friendlyMessage(code, constraint, message);
  err.isExpected = isExpectedBusinessError(raw);
  err.raw = raw;

  return err;
}
