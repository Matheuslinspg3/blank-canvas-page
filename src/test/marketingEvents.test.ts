import { describe, expect, it } from 'vitest';
import { trackMarketingEvent } from '@/lib/marketingEvents';

describe('marketingEvents', () => {
  it('não falha tracking desativado', () => {
    const res = trackMarketingEvent('Lead', { foo: 'bar' });
    expect(res).toBeNull();
  });
});
