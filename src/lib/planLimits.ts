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
/**
 * Normalize an identifier (slug or name) for robust comparison.
 * Removes accents, converts to lowercase, replaces spaces/dashes with underscores,
 * and removes all non-alphanumeric characters.
 */
function normalizeIdentifier(val: string | null | undefined): string {
  if (!val) return '';
  return val
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[-\s]/g, '_') // dash/space to underscore
    .replace(/[^a-z0-9_]/g, ''); // remove special chars
}

/**
 * The internal_unlimited plan ALWAYS bypasses every product limit,
 * regardless of column values, role, or feature flags.
 */
export function isOrgOnInternalUnlimited(
  plan: { slug?: string | null; name?: string | null; features?: any } | null | undefined,
): boolean {
  if (!plan) return false;

  // 1. Explicit marker in features JSONB
  if (plan.features?.is_internal_unlimited === true) return true;

  // 2. Normalized slug check
  const nSlug = normalizeIdentifier(plan.slug);
  if (
    nSlug === 'internal_unlimited' ||
    nSlug === 'interno_unlimited' ||
    nSlug === 'plano_interno_unlimited'
  ) {
    return true;
  }

  // 3. Normalized name check
  const nName = normalizeIdentifier(plan.name);
  if (
    nName === 'internal_unlimited' ||
    nName === 'interno_unlimited' ||
    nName === 'plano_interno_unlimited'
  ) {
    return true;
  }

  return false;
}

/** True if this plan should be hidden from public upgrade UIs and checkout. */
export const PUBLIC_COMMERCIAL_PLAN_SLUGS = ['essencial', 'profissional', 'business'] as const;

export function isPublicCommercialPlan(
  plan: { slug?: string | null; plan_type?: string | null; features?: any } | null | undefined,
): boolean {
  if (!plan?.slug) return false;
  if (isInternalPlan(plan)) return false;
  const feat = (plan as any).features;
  if (feat && typeof feat === 'object' && feat.is_purchasable === false) return false;
  return (PUBLIC_COMMERCIAL_PLAN_SLUGS as readonly string[]).includes(plan.slug);
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
