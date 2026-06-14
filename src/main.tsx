import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { APP_VERSION } from "./config/appVersion";
import { isImportChunkError, isMimeMismatchError } from "./utils/chunkErrorDetection";
import { safeReloadOnce } from "./utils/safeReload";
import { isProductLimitError } from "./lib/planLimits";
import { isExpectedDbValidationError } from "./utils/expectedDbErrors";
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
    for (const reg of registrations) {
      const scriptUrl = reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? "";
      const scopePath = new URL(reg.scope).pathname;

      // Unregister orphan root-scope workers that point to a non-existent /sw.js
      // (leftover from previous PWA plugin deploys)
      const isOrphanRootWorker =
        scopePath === "/" &&
        !scriptUrl.includes("OneSignal") &&
        (scriptUrl.endsWith("/sw.js") || scriptUrl === "");

      if (isOrphanRootWorker) {
        reg.unregister().catch(() => {});
        continue;
      }

      // Only observe and update registrations that have a live worker
      if (reg.active || reg.installing || reg.waiting) {
        observeRegistration(reg);
        reg.update().catch((err) => {
          console.debug("[sw-update] failed:", err);
        });
      }
    }
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
    // SW load failures in cross-origin iframes (SecurityError / TypeError)
    "sw.js load failed",
    // Expected product/plan limit errors — handled by controlled toasts.
    "ProductLimitError",
    // Service Worker lifecycle errors — transient during deploys, no user impact.
    // REACT-2W: fetch failure during SW update
    "Failed to update a ServiceWorker",
    // REACT-C: SW script error during installation (stale chunks post-deploy)
    "ServiceWorker script at",
    // REACT-3Y: workbox-window internal race condition
    "newestWorker is null",
  ],
  beforeSend(event, hint) {
    const err = hint?.originalException;
    // Drop expected business errors (plan limit reached, etc.) — never critical.
    if (isProductLimitError(err)) return null;
    // Drop expected, user-actionable DB validations (e.g. marketplace publish
    // requires a primary owner with a valid phone). Already shown via toast.
    if (isExpectedDbValidationError(err)) return null;
    if (isImportChunkError(err)) {
      // Chunk errors are recoverable: the global handlers call safeReloadOnce(),
      // which reloads the page onto the freshly deployed assets. They are stale-chunk
      // post-deploy artifacts, not hard failures — report as warning, not error.
      event.level = "warning";
      // Consolidate every chunk-load variant (workbox-window, vendor-*, any hash)
      // into a single issue so each deploy doesn't spawn a brand-new "Regressed" issue.
      event.fingerprint = ["chunk-load-error"];
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

import {
  isPwaRuntimeEnabled,
  isPreviewHost,
  isInIframe,
  isProductionBuild,
  getServiceWorkerControllerState,
} from "./utils/runtimeEnvironment";

// Extract a chunk URL from a vite:preloadError payload, when present.
function extractChunkUrl(payload: unknown): string | null {
  try {
    const msg =
      typeof payload === "string"
        ? payload
        : (payload as any)?.message ?? (payload as any)?.payload?.message ?? "";
    const m = String(msg).match(/\/assets\/[^\s"']+\.(?:js|css|mjs)/);
    return m ? m[0] : null;
  } catch {
    return null;
  }
}

// Global handlers — catch chunk errors that escape React boundaries.
const handleGlobalChunkError = (err: unknown, source: string, chunkUrl?: string | null) => {
  if (!isImportChunkError(err)) return;
  console.warn(`[chunk-error:${source}]`, err);
  Sentry.captureException(err, {
    tags: {
      chunk_error: "true",
      source,
      hostname: window.location.hostname,
      is_preview_host: String(isPreviewHost),
      is_iframe: String(isInIframe),
      pwa_runtime_enabled: String(isPwaRuntimeEnabled),
      sw_controller: getServiceWorkerControllerState(),
      route: window.location.pathname,
      release: APP_VERSION,
    },
    extra: {
      chunk_url: chunkUrl ?? extractChunkUrl(err),
    },
  });
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
  const payload = (e as any).payload ?? e;
  handleGlobalChunkError(payload, "vite:preloadError", extractChunkUrl(payload));
  e.preventDefault();
});

// PostHog initialization — after Sentry, before React
import { initPostHog } from "./lib/posthog";
import { initMetaPixel } from "./lib/metaPixel";
initPostHog();
initMetaPixel();

// PWA / Service Worker lifecycle:
//  - Disabled in preview, iframe and dev → unregister any leftover SWs and
//    clear caches so stale chunks don't haunt the next reload.
//  - Enabled only in real production deployments.
if (!isPwaRuntimeEnabled) {
  navigator.serviceWorker?.getRegistrations().then((regs) =>
    regs.forEach((r) => r.unregister()),
  );
  // Aggressive cache cleanup ONLY off-prod — never wipe caches in production.
  if (!isProductionBuild && typeof caches !== "undefined") {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
} else {
  setupServiceWorkerUpdateRoutine();
}

createRoot(document.getElementById("root")!).render(<App />);
