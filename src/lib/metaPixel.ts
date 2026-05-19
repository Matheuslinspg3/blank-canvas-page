/**
 * Meta Pixel Tracking Utility
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

const ENABLED = import.meta.env.VITE_ENABLE_MARKETING_TRACKING === 'true';
const PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID;

/**
 * Injects Meta Pixel script if enabled and Pixel ID is provided.
 */
export function initMetaPixel() {
  if (!ENABLED || !PIXEL_ID || typeof window === 'undefined') return;

  // Standard Meta Pixel injection code
  (function(f: any, b: any, e: any, v: any, n: any, t: any, s: any) {
    if (f.fbq) return;
    n = f.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq?.('init', PIXEL_ID);
  window.fbq?.('track', 'PageView');
}

/**
 * Tracks a Meta Pixel event with an optional event_id for deduplication.
 */
export function trackPixelEvent(eventName: string, params: Record<string, any> = {}, eventId?: string) {
  if (!ENABLED || !PIXEL_ID || !window.fbq) return;

  const eventParams = {
    ...params,
  };

  if (eventId) {
    window.fbq('track', eventName, eventParams, { event_id: eventId });
  } else {
    window.fbq('track', eventName, eventParams);
  }
}
