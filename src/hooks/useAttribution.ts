import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * attribution_context interface
 */
export interface AttributionContext {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  landing_page?: string | null;
  referrer?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  session_id?: string | null;
  anonymous_id?: string | null;
}

const STORAGE_KEY = 'porta_attribution_v1';
const ANON_ID_KEY = 'porta_anon_id';

function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getAttribution(): AttributionContext {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function setAttribution(ctx: AttributionContext) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ctx));
}

export function useAttribution() {
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const utm_source = searchParams.get('utm_source');
    const utm_medium = searchParams.get('utm_medium');
    const utm_campaign = searchParams.get('utm_campaign');
    const utm_content = searchParams.get('utm_content');
    const utm_term = searchParams.get('utm_term');
    const fbclid = searchParams.get('fbclid');
    const gclid = searchParams.get('gclid');

    let anonId = localStorage.getItem(ANON_ID_KEY);
    if (!anonId) {
      anonId = generateId();
      localStorage.setItem(ANON_ID_KEY, anonId);
    }

    const current = getAttribution();
    const hasCampaign = !!(utm_source || utm_medium || utm_campaign || fbclid || gclid);
    const now = new Date().toISOString();

    if (!current.first_seen_at) {
      current.first_seen_at = now;
      current.landing_page = window.location.href;
      current.referrer = document.referrer || null;
      current.anonymous_id = anonId;
      current.session_id = generateId();
    }

    if (hasCampaign) {
      current.utm_source = utm_source || current.utm_source;
      current.utm_medium = utm_medium || current.utm_medium;
      current.utm_campaign = utm_campaign || current.utm_campaign;
      current.utm_content = utm_content || current.utm_content;
      current.utm_term = utm_term || current.utm_term;
      current.fbclid = fbclid || current.fbclid;
      current.gclid = gclid || current.gclid;
      current.last_seen_at = now;
    }

    setAttribution(current);
  }, [location.search, location.pathname]);

  return getAttribution();
}
