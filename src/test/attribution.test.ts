import { beforeEach, describe, expect, it } from 'vitest';
import { captureAttributionFromUrl, clearAttributionContext, getAttributionContext, getOrCreateEventId } from '@/lib/attribution';

describe('attribution', () => {
  beforeEach(() => { localStorage.clear(); history.replaceState({}, '', '/'); clearAttributionContext(); });
  it('captura utms e click ids', () => {
    history.replaceState({}, '', '/?utm_source=meta&utm_campaign=x&fbclid=1&gclid=2');
    const ctx = captureAttributionFromUrl();
    expect(ctx?.utm_source).toBe('meta'); expect(ctx?.fbclid).toBe('1'); expect(ctx?.gclid).toBe('2');
  });
  it('preserva first_touch', () => {
    history.replaceState({}, '', '/?utm_source=a'); const a = captureAttributionFromUrl();
    history.replaceState({}, '', '/interna'); const b = captureAttributionFromUrl();
    expect(a?.first_seen_at).toBe(b?.first_seen_at);
  });
  it('gera event id', () => expect(getOrCreateEventId('Lead')).toBeTypeOf('string'));
});
