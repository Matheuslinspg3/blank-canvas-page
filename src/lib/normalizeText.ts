/**
 * Remove acentos/diacríticos e normaliza casing/espaços.
 * Usado para deduplicar nomes de cidades/bairros que diferem apenas por acentuação.
 *
 * Ex.: "Mongaguá" e "Mongagua" → ambos viram "mongagua".
 */
export function normalizeAccentsKey(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Deduplica uma lista de strings usando chave normalizada (sem acento, lowercase).
 * Mantém a primeira ocorrência da grafia "preferida": prioriza a versão que contém
 * caracteres acentuados (mais provável de ser a grafia ortograficamente correta em pt-BR).
 */
export function dedupeByAccentKey(values: ReadonlyArray<string | null | undefined>): string[] {
  const map = new Map<string, string>();
  for (const raw of values) {
    const val = raw?.trim();
    if (!val) continue;
    const key = normalizeAccentsKey(val);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, val);
      continue;
    }
    // Prefere a variação que possui acento (heurística: difere da chave normalizada)
    const existingHasAccent = normalizeAccentsKey(existing) !== existing.toLowerCase();
    const newHasAccent = normalizeAccentsKey(val) !== val.toLowerCase();
    if (newHasAccent && !existingHasAccent) {
      map.set(key, val);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
