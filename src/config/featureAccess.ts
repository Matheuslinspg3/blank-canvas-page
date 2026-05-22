/**
 * Centralized feature access control — Operational slimming phase.
 *
 * Source of truth for which features are restricted to `developer` role.
 * Nothing is removed from code/DB/routes — features are merely hidden from
 * non-developer users. Reverting is trivial: remove the key from this file.
 */

export const DEVELOPER_ONLY_FEATURES = {
  CRM_WHATSAPP_TEMPLATES: "crm.whatsapp_templates",
  // NOTE: Financeiro > Templates e Financeiro > Financiamentos são ABAS
  // dentro da rota `/financeiro` (não rotas standalone). O bloqueio acontece
  // em `src/pages/Financial.tsx` via `canAccessFeature(...)`, não em
  // `App.tsx`. A própria rota `/financeiro` permanece acessível a todos.
  FINANCEIRO_TEMPLATES: "financeiro.templates",
  FINANCEIRO_FINANCIAMENTOS: "financeiro.financiamentos",
  CORRESPONDENTE: "correspondente",
  MARKETING_GERADOR_IA: "marketing.gerador_ia",
  MARKETING_ARTES: "marketing.artes",
  MARKETING_VIDEO: "marketing.video",
  MARKETING_MARCA: "marketing.marca",
  MEU_WHATSAPP: "meu_whatsapp",
  AUTOMACOES: "automacoes",
  GESTAO_PORTAIS_ANUNCIO: "gestao.portais_anuncio",
  GESTAO_MEU_SITE: "gestao.meu_site",
  GESTAO_CANAIS_EQUIPE: "gestao.canais_equipe",
} as const;

export type DeveloperOnlyFeatureKey =
  (typeof DEVELOPER_ONLY_FEATURES)[keyof typeof DEVELOPER_ONLY_FEATURES];

/** Set of all developer-only feature keys (O(1) lookup). */
export const DEVELOPER_ONLY_FEATURE_SET: ReadonlySet<string> = new Set(
  Object.values(DEVELOPER_ONLY_FEATURES),
);

/**
 * Centralized sidebar visibility logic — Prevents flicker during rehydration.
 */
export function getSidebarVisibilityFlags({
  isDeveloper,
  hasFeature,
  isLoadingAuth,
  isLoadingRoles,
  isLoadingSubscription,
  hasAuthenticatedUser,
}: {
  isDeveloper: boolean;
  hasFeature: (key: string) => boolean;
  isLoadingAuth: boolean;
  isLoadingRoles: boolean;
  isLoadingSubscription: boolean;
  hasAuthenticatedUser: boolean;
}) {
  const isAnyLoading = isLoadingAuth || isLoadingRoles || isLoadingSubscription;

  // During loading, if we have a user session, we keep items visible to avoid 
  // the sidebar jumping/shrinking before roles/subscription data arrives.
  const showWhatsApp =
    isDeveloper || hasFeature("has_whatsapp") || (isAnyLoading && hasAuthenticatedUser);

  const showAutomations =
    isDeveloper || hasFeature("has_automations") || (isAnyLoading && hasAuthenticatedUser);

  const showBrandSettings = 
    isDeveloper || hasFeature("has_brand_settings") || (isAnyLoading && hasAuthenticatedUser);

  return { showWhatsApp, showAutomations, showBrandSettings };
}

/**
 * Routes (path prefixes) that only `developer` users can access.
 * Subroutes are also blocked — `/automacoes/logs` matches `/automacoes`.
 */
export const DEVELOPER_ONLY_ROUTES: readonly string[] = [
  "/correspondente",
  // `/financiamentos` NÃO é listado: é aba dentro de `/financeiro`,
  // gated em Financial.tsx via FINANCEIRO_FINANCIAMENTOS.
  "/automacoes",
  "/whatsapp/automacoes",
  "/whatsapp/canais-equipe",
];

/** True when `key` is restricted to developer role. */
export function isDeveloperOnlyFeature(key: string): boolean {
  return DEVELOPER_ONLY_FEATURE_SET.has(key);
}

/**
 * True when `path` (or any of its parents) is a developer-only route.
 * Matches both exact paths and subpaths (e.g. `/whatsapp/meu-canal/chat`).
 */
export function isDeveloperOnlyRoute(path: string): boolean {
  if (!path) return false;
  const normalized = path.split("?")[0].split("#")[0];
  return DEVELOPER_ONLY_ROUTES.some(
    (route) => normalized === route || normalized.startsWith(route + "/"),
  );
}
