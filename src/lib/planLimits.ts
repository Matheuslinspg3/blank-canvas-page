/**
 * Centralized helpers for product/plan limit checks.
 *
 * Convention:
 *   - `null` / `undefined`     → unlimited (no cap)
 *   - `-1`                     → unlimited
 *   - `Infinity`               → unlimited
 *   - finite number ≥ 0        → real cap
 *
 * `ProductLimitError` represents an *expected business* error.
 * It must be displayed via a controlled UI (toast/modal with upgrade CTA)
 * and must NOT be captured by Sentry as a critical exception.
 */

export type ResourceKind =
  | 'properties'
  | 'marketplace_properties'
  | 'leads'
  | 'users'
  | 'custom_domains'
  | 'storage_mb'
  | 'ai_credits';

export interface ProductLimitErrorPayload {
  code: string;
  resource: ResourceKind;
  limit: number;
  current?: number;
  /** Friendly PT-BR message shown to the end user. */
  message?: string;
}

export class ProductLimitError extends Error {
  readonly name = 'ProductLimitError';
  readonly code: string;
  readonly resource: ResourceKind;
  readonly limit: number;
  readonly current?: number;
  /** Marker so Sentry beforeSend / global handlers can drop these silently. */
  readonly isProductLimit = true as const;
  readonly isExpected = true as const;

  constructor(payload: ProductLimitErrorPayload) {
    super(payload.message ?? `Limite atingido para ${payload.resource}`);
    this.code = payload.code;
    this.resource = payload.resource;
    this.limit = payload.limit;
    this.current = payload.current;
    Object.setPrototypeOf(this, ProductLimitError.prototype);
  }
}

/** Type guard. Cross-realm safe via duck typing. */
export function isProductLimitError(err: unknown): err is ProductLimitError {
  if (err instanceof ProductLimitError) return true;
  if (err && typeof err === 'object' && (err as any).isProductLimit === true) return true;
  if (err && typeof err === 'object' && (err as any).name === 'ProductLimitError') return true;
  return false;
}

/** True when the limit means "no cap". */
export function isUnlimitedLimit(limit: number | null | undefined): boolean {
  if (limit === null || limit === undefined) return true;
  if (limit === -1) return true;
  if (typeof limit !== 'number') return true;
  if (!Number.isFinite(limit)) return true;
  return false;
}

/** True when consumption already meets or exceeds the cap. */
export function hasReachedLimit(current: number, limit: number | null | undefined): boolean {
  if (isUnlimitedLimit(limit)) return false;
  return current >= (limit as number);
}

/**
 * The internal_unlimited plan ALWAYS bypasses every product limit,
 * regardless of column values, role, or feature flags.
 */
export function isOrgOnInternalUnlimited(plan: { slug?: string | null } | null | undefined): boolean {
  return (plan?.slug ?? '').toLowerCase() === 'internal_unlimited';
}

/** True if this plan should be hidden from public upgrade UIs and checkout. */
export function isInternalPlan(
  plan: { slug?: string | null; features?: any } | null | undefined,
): boolean {
  if (!plan) return false;
  if (isOrgOnInternalUnlimited(plan)) return true;
  const feat = (plan as any).features;
  if (feat && typeof feat === 'object' && feat.is_internal === true) return true;
  return false;
}
