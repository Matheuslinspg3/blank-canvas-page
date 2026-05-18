import { buildAttributionPayload, getOrCreateEventId } from "./attribution";

const enabled = () => import.meta.env.VITE_ENABLE_MARKETING_TRACKING === "true";
const pixelId = () => import.meta.env.VITE_META_PIXEL_ID as string | undefined;
const ga4Id = () => import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;

declare global { interface Window { fbq?: (...args: unknown[]) => void; gtag?: (...args: unknown[]) => void; dataLayer?: unknown[]; } }

export function initMarketingTracking() {
  if (typeof window === "undefined" || !enabled()) return;
  if (pixelId() && !window.fbq) {
    !(function(f:any,b,d,s,u?:string,t?:any,n?:any){if(f.fbq)return;u=f.fbq=function(){u.callMethod?u.callMethod.apply(u,arguments):u.queue.push(arguments)};if(!f._fbq)f._fbq=u;u.push=u;u.loaded=!0;u.version='2.0';u.queue=[];t=b.createElement(d);t.async=!0;t.src=s;n=b.getElementsByTagName(d)[0];n.parentNode.insertBefore(t,n)})(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq?.("init", pixelId());
  }
  if (ga4Id() && !window.gtag) {
    const s = document.createElement("script"); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id()}`; document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = (...args) => window.dataLayer?.push(args);
    window.gtag("js", new Date()); window.gtag("config", ga4Id());
  }
}

export function trackMarketingEvent(eventName: string, params: Record<string, unknown> = {}) {
  if (!enabled()) return null;
  const event_id = getOrCreateEventId(eventName);
  const payload = { ...params, ...buildAttributionPayload(), event_id };
  if (window.fbq && pixelId()) window.fbq("trackCustom", eventName, payload, { eventID: event_id });
  if (window.gtag && ga4Id()) window.gtag("event", eventName, payload);
  return { event_id, payload };
}
export const trackPageView = () => trackMarketingEvent("PageView", { path: typeof window !== "undefined" ? window.location.pathname : "" });
export const trackViewContent = (params: Record<string, unknown> = {}) => trackMarketingEvent("ViewContent", params);
export const trackClickWhatsApp = (params: Record<string, unknown> = {}) => trackMarketingEvent("ClickWhatsApp", params);
export const trackFormStarted = (params: Record<string, unknown> = {}) => trackMarketingEvent("FormStarted", params);
export const trackLead = (params: Record<string, unknown> = {}) => trackMarketingEvent("Lead", params);
export const trackCompleteRegistration = (params: Record<string, unknown> = {}) => trackMarketingEvent("CompleteRegistration", params);
export const trackTrialStarted = (params: Record<string, unknown> = {}) => trackMarketingEvent("TrialStarted", params);
export const trackLeadCreated = (params: Record<string, unknown> = {}) => trackMarketingEvent("LeadCreated", params);
export const trackSubscribe = (params: Record<string, unknown> = {}) => trackMarketingEvent("Subscribe", params);
