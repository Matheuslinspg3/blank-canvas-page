import { describe, it, expect } from 'vitest';
import { getFeatureLimit } from '@/hooks/useSubscription';
import {
  isUnlimitedLimit,
  hasReachedLimit,
  isOrgOnInternalUnlimited,
  isInternalPlan,
  ProductLimitError,
  isProductLimitError,
} from '@/lib/planLimits';

// Synthetic plans matching DB state after the latest migration.
const essencial = { slug: 'essencial', features: { max_marketplace_properties: 20, max_custom_domains: 0 } } as any;
const profissional = { slug: 'profissional', features: { max_marketplace_properties: 100, max_custom_domains: 0 } } as any;
const imobiliaria = { slug: 'business', features: { max_marketplace_properties: -1, max_custom_domains: 1 } } as any;

describe('getFeatureLimit — max_custom_domains', () => {
  it('Essencial blocks (limit 0)', () => {
    expect(getFeatureLimit(essencial, 'max_custom_domains')).toBe(0);
  });
  it('Profissional blocks (limit 0)', () => {
    expect(getFeatureLimit(profissional, 'max_custom_domains')).toBe(0);
  });
  it('Imobiliária allows exactly 1', () => {
    expect(getFeatureLimit(imobiliaria, 'max_custom_domains')).toBe(1);
  });
  it('No plan → 0 (fail closed)', () => {
    expect(getFeatureLimit(null, 'max_custom_domains')).toBe(0);
  });
  it('Plan with missing/null limit → 0 (fail closed)', () => {
    const broken = { slug: 'profissional', features: {} } as any;
    expect(getFeatureLimit(broken, 'max_custom_domains')).toBe(0);
  });
  it('Plan with NaN/string limit → 0 (fail closed)', () => {
    const broken = { slug: 'profissional', features: { max_custom_domains: 'abc' } } as any;
    expect(getFeatureLimit(broken, 'max_custom_domains')).toBe(0);
  });
  it('Imobiliária with -1 in custom_domains is unlimited (explicit)', () => {
    const unl = { slug: 'business', features: { max_custom_domains: -1 } } as any;
    expect(getFeatureLimit(unl, 'max_custom_domains')).toBe(Infinity);
  });
});

describe('getFeatureLimit — max_marketplace_properties', () => {
  it('Essencial limit is 20', () => {
    expect(getFeatureLimit(essencial, 'max_marketplace_properties')).toBe(20);
  });
  it('Profissional limit is 100', () => {
    expect(getFeatureLimit(profissional, 'max_marketplace_properties')).toBe(100);
  });
  it('Imobiliária is unlimited (-1)', () => {
    expect(getFeatureLimit(imobiliaria, 'max_marketplace_properties')).toBe(Infinity);
  });
  it('Plan with missing limit → 0 (fail closed)', () => {
    const broken = { slug: 'essencial', features: {} } as any;
    expect(getFeatureLimit(broken, 'max_marketplace_properties')).toBe(0);
  });
});

describe('isUnlimitedLimit', () => {
  it('null/undefined are unlimited', () => {
    expect(isUnlimitedLimit(null)).toBe(true);
    expect(isUnlimitedLimit(undefined)).toBe(true);
  });
  it('-1 is unlimited', () => expect(isUnlimitedLimit(-1)).toBe(true));
  it('Infinity is unlimited', () => expect(isUnlimitedLimit(Infinity)).toBe(true));
  it('0 is NOT unlimited (real cap of zero)', () => expect(isUnlimitedLimit(0)).toBe(false));
  it('positive finite is NOT unlimited', () => expect(isUnlimitedLimit(10)).toBe(false));
});

describe('hasReachedLimit', () => {
  it('never reached when unlimited', () => {
    expect(hasReachedLimit(9999, null)).toBe(false);
    expect(hasReachedLimit(9999, -1)).toBe(false);
    expect(hasReachedLimit(9999, Infinity)).toBe(false);
  });
  it('reached when current >= limit', () => {
    expect(hasReachedLimit(10, 10)).toBe(true);
    expect(hasReachedLimit(11, 10)).toBe(true);
  });
  it('not reached when current < limit', () => {
    expect(hasReachedLimit(9, 10)).toBe(false);
  });
  it('reached when limit is 0 (no allowance)', () => {
    expect(hasReachedLimit(0, 0)).toBe(true);
  });
});

describe('isOrgOnInternalUnlimited / isInternalPlan', () => {
  it('detects internal_unlimited slug and variations (case/accent insensitive)', () => {
    expect(isOrgOnInternalUnlimited({ slug: 'internal_unlimited' })).toBe(true);
    expect(isOrgOnInternalUnlimited({ slug: 'INTERNAL_UNLIMITED' })).toBe(true);
    expect(isOrgOnInternalUnlimited({ slug: 'internal-unlimited' })).toBe(true);
    expect(isOrgOnInternalUnlimited({ slug: 'plano-interno-unlimited' })).toBe(true);
    expect(isOrgOnInternalUnlimited({ slug: 'interno_unlimited' })).toBe(true);
    expect(isOrgOnInternalUnlimited({ slug: 'Plano Interno Unlimited' })).toBe(true);
    expect(isOrgOnInternalUnlimited({ name: 'Plano Interno Unlimited', slug: 'something_else' })).toBe(true);
    expect(isOrgOnInternalUnlimited({ features: { is_internal_unlimited: true } })).toBe(true);
    expect(isOrgOnInternalUnlimited({ slug: 'business' })).toBe(false);
    expect(isOrgOnInternalUnlimited(null)).toBe(false);
  });
  it('isInternalPlan recognizes slug and features.is_internal', () => {
    expect(isInternalPlan({ slug: 'internal_unlimited' })).toBe(true);
    expect(isInternalPlan({ slug: 'foo', features: { is_internal: true } })).toBe(true);
    expect(isInternalPlan({ slug: 'business' })).toBe(false);
    expect(isInternalPlan(null)).toBe(false);
  });
  it('getFeatureLimit returns Infinity for internal_unlimited regardless of key', () => {
    const internal = { slug: 'internal_unlimited', features: { max_custom_domains: 0 } } as any;
    expect(getFeatureLimit(internal, 'max_own_properties')).toBe(Infinity);
    expect(getFeatureLimit(internal, 'max_custom_domains')).toBe(Infinity);
    expect(getFeatureLimit(internal, 'max_marketplace_properties')).toBe(Infinity);
    expect(getFeatureLimit(internal, 'ai_credits_limit')).toBe(Infinity);
  });
});

describe('ProductLimitError', () => {
  it('is an Error and is detected by type guard', () => {
    const err = new ProductLimitError({
      code: 'PROPERTY_LIMIT_REACHED',
      resource: 'properties',
      limit: 10,
      current: 10,
      message: 'Seu plano permite até 10 imóveis. Faça upgrade para adicionar mais.',
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ProductLimitError);
    expect(err.name).toBe('ProductLimitError');
    expect(err.code).toBe('PROPERTY_LIMIT_REACHED');
    expect(err.resource).toBe('properties');
    expect(err.limit).toBe(10);
    expect(err.isProductLimit).toBe(true);
    expect(err.isExpected).toBe(true);
    expect(isProductLimitError(err)).toBe(true);
  });
  it('type guard rejects unrelated errors', () => {
    expect(isProductLimitError(new Error('boom'))).toBe(false);
    expect(isProductLimitError(null)).toBe(false);
    expect(isProductLimitError({ code: '23505' })).toBe(false);
  });
  it('type guard accepts duck-typed objects (cross-realm safe)', () => {
    const fake = { name: 'ProductLimitError', isProductLimit: true, message: 'x' };
    expect(isProductLimitError(fake)).toBe(true);
  });
});
