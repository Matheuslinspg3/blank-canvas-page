// Tipos das regras de ITBI armazenadas em jsonb (itbi_rules.rule)

export type ItbiBase = "venda" | "venal" | "maior_entre_venal_e_venda";

export type ItbiRuleFlat = {
  type: "flat";
  rate: number; // %
  base?: ItbiBase;
};

export type ItbiBracket = {
  up_to?: number; // valor limite superior (R$); ausente = ilimitado
  rate: number; // %
};

export type ItbiRuleProgressive = {
  type: "progressive";
  brackets: ItbiBracket[];
  base?: ItbiBase;
};

export type ItbiRuleFinancedSplit = {
  type: "financed_split";
  rate_financed: number; // % aplicada à parcela financiada
  rate_unfinanced: number; // % aplicada à parcela não financiada
  base?: ItbiBase;
};

export type ItbiRule = ItbiRuleFlat | ItbiRuleProgressive | ItbiRuleFinancedSplit;

export type ItbiConfidence =
  | "oficial_validada"
  | "oficial"
  | "estimativa_uf"
  | "fallback";

export type ItbiSource = "org_override" | "municipio" | "uf" | "fallback";

export interface ResolvedItbi {
  source: ItbiSource;
  confidence: ItbiConfidence;
  rule: ItbiRule;
  rule_version: number;
  source_url: string | null;
  source_label: string | null;
  ibge_code: string | null;
  uf: string | null;
}

export interface ItbiCalculation {
  value: number;
  effectiveRate: number; // taxa equivalente sobre o valor base
  breakdown: Array<{ label: string; value: number }>;
  confidence: ItbiConfidence;
  sourceLabel: string | null;
  sourceUrl: string | null;
  ruleVersion: number;
  rule: ItbiRule;
}
