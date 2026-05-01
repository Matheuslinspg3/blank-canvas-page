import { describe, it, expect } from 'vitest';
import { getFeatureLimit } from '@/hooks/useSubscription';

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
