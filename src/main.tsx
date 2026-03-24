import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { APP_VERSION } from "./config/appVersion";
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
});

setupServiceWorkerUpdateRoutine();
createRoot(document.getElementById("root")!).render(<App />);
