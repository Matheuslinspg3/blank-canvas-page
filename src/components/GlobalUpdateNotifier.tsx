import { useVersionPolling } from "@/hooks/useVersionPolling";
import { UpdateBanner } from "@/components/UpdateBanner";

/**
 * Global mount point for version polling + update banner.
 * Must be rendered ONCE inside <BrowserRouter> so that:
 *  - useVersionPolling has access to useLocation()
 *  - the banner appears on EVERY route (public + private), not only AppLayout.
 *
 * Previously this logic lived inside AppLayout, which meant public routes
 * like /marketplace, /imoveis/:slug, /site/:slug never received the
 * "new version available" prompt and kept Sentry filled with errors from
 * stale bundles after deploys.
 */
export function GlobalUpdateNotifier() {
  useVersionPolling();
  return <UpdateBanner />;
}
