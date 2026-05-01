/**
 * Centralized feature access control — Operational slimming phase.
 *
 * Source of truth for which features are restricted to `developer` role.
 * Nothing is removed from code/DB/routes — features are merely hidden from
 * non-developer users. Reverting is trivial: remove the key from this file.
 */

export const DEVELOPER_ONLY_FEATURES = {
  CRM_WHATSAPP_TEMPLATES: "crm.whatsapp_templates",
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
 * Routes (path prefixes) that only `developer` users can access.
 * Subroutes are also blocked — `/whatsapp/meu-canal/chat` matches `/whatsapp/meu-canal`.
 */
export const DEVELOPER_ONLY_ROUTES: readonly string[] = [
  "/correspondente",
  "/financiamentos",
  "/automacoes",
  "/whatsapp/meu-canal",
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
