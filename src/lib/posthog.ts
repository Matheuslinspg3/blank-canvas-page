import posthog from 'posthog-js';

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

/** Initialize PostHog — call once before React renders */
export function initPostHog() {
  if (!POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-ph-mask]',
    },
  });
}

/** Identify user after login */
export function identifyUser(userId: string, email?: string, name?: string) {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, {
    email: email ?? undefined,
    name: name ?? email ?? undefined,
  });
}

/** Reset PostHog session on logout */
export function resetPostHog() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

/** Track a custom event */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}
