import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { APP_VERSION } from "./config/appVersion";
import { isImportChunkError, isMimeMismatchError } from "./utils/chunkErrorDetection";
import { safeReloadOnce } from "./utils/safeReload";
// Capture beforeinstallprompt globally so it's available even if Install page mounts later
declare global {
  interface WindowEventMap {
    beforeinstallprompt: Event;
  }
  interface Window {
    __pwaInstallPrompt: Event | null;
    __newVersionAvailable: boolean;
  }
}
window.__pwaInstallPrompt = null;
window.__newVersionAvailable = false;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__pwaInstallPrompt = e;
});

// autoPurgeCloudflare removed — domain connected directly to Lovable, no CDN to purge
// Version polling removed — relying solely on Service Worker update routine (setupServiceWorkerUpdateRoutine)

function setupServiceWorkerUpdateRoutine() {
  if (!("serviceWorker" in navigator)) return;

  const handleNewVersion = (_registration: ServiceWorkerRegistration) => {

    window.__newVersionAvailable = true;
    window.dispatchEvent(new CustomEvent("sw-update-available"));
    // Do NOT call skipWaiting here — let the UpdateBanner handle it on user click.
    // Calling it early causes the waiting SW to activate before the user clicks,
    // leaving updateServiceWorker(true) with nothing to do.
  };

  const observeRegistration = (registration: ServiceWorkerRegistration | undefined) => {
    if (!registration) return;
    if (registration.waiting) {
      handleNewVersion(registration);
    }
    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;
      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          handleNewVersion(registration);
        }
      });
    });
  };

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;

    window.location.reload();
  });

  window.addEventListener("load", async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    registrations.forEach((reg) => {
      observeRegistration(reg);
      reg.update().catch(() => {});
    });
  });
}

// Sentry initialization — runs before React mounts
Sentry.init({
  dsn: "https://4e7cb884a6e450781b9c709051291981@o4511097037258752.ingest.us.sentry.io/4511097081692160",
  sendDefaultPii: true,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  release: `porta@${APP_VERSION}`,
  ignoreErrors: [
    // Supabase Auth navigatorLock timeout — benign, no user impact
    "signal is aborted without reason",
    "The operation was aborted",
    // Network blips
    "Failed to fetch",
    "NetworkError",
    "Load failed",
  ],
  beforeSend(event, hint) {
    const err = hint?.originalException;
    if (isImportChunkError(err)) {
      event.tags = {
        ...event.tags,
        chunk_error: "true",
        mime_mismatch: isMimeMismatchError(err) ? "true" : "false",
        route: window.location.pathname,
      };
      event.contexts = {
        ...event.contexts,
        runtime: {
          online: navigator.onLine,
          visibility: document.visibilityState,
          connection: (navigator as any).connection?.effectiveType ?? "unknown",
          sw_controller: !!navigator.serviceWorker?.controller,
          release: APP_VERSION,
        },
      };
      // Dedup: at most 1 chunk error per session+route to avoid Sentry noise.
      try {
        const key = `lov_chunk_sent_${window.location.pathname}`;
        if (sessionStorage.getItem(key)) return null;
        sessionStorage.setItem(key, "1");
      } catch {
        /* no-op */
      }
    }
    return event;
  },
});

// Global handlers — catch chunk errors that escape React boundaries.
const handleGlobalChunkError = (err: unknown, source: string) => {
  if (!isImportChunkError(err)) return;
  console.warn(`[chunk-error:${source}]`, err);
  safeReloadOnce(`global:${source}`);
};

window.addEventListener("error", (e) => {
  handleGlobalChunkError(e.error ?? e.message, "window.error");
});
window.addEventListener("unhandledrejection", (e) => {
  handleGlobalChunkError(e.reason, "unhandledrejection");
});
// Vite 5 emits this when a preloaded chunk fails — perfect for early detection.
window.addEventListener("vite:preloadError", (e: Event) => {
  handleGlobalChunkError((e as any).payload ?? e, "vite:preloadError");
  e.preventDefault();
});

// PostHog initialization — after Sentry, before React
import { initPostHog } from "./lib/posthog";
initPostHog();

// Guard: never register SW in iframe or Lovable preview
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) =>
    regs.forEach((r) => r.unregister())
  );
} else {
  setupServiceWorkerUpdateRoutine();
}

createRoot(document.getElementById("root")!).render(<App />);
