import type {
  ItbiCalculation,
  ItbiRule,
  ResolvedItbi,
} from "./types";

interface CalcInput {
  resolved: ResolvedItbi;
  propertyValue: number;
  financedValue?: number;
}

/**
 * Calculadora pura de ITBI. Recebe a regra resolvida (via RPC `resolve_itbi`)
 * e devolve o valor + breakdown + metadados de auditoria.
 */
export function calculateItbi({
  resolved,
  propertyValue,
  financedValue = 0,
}: CalcInput): ItbiCalculation {
  const rule = resolved.rule;
  const base = Math.max(propertyValue, 0);

  const result = applyRule(rule, base, financedValue);

  return {
    value: round2(result.value),
    effectiveRate: base > 0 ? (result.value / base) * 100 : 0,
    breakdown: result.breakdown,
    confidence: resolved.confidence,
    sourceLabel: resolved.source_label,
    sourceUrl: resolved.source_url,
    ruleVersion: resolved.rule_version,
    rule,
  };
}

function applyRule(
  rule: ItbiRule,
  base: number,
  financed: number,
): { value: number; breakdown: ItbiCalculation["breakdown"] } {
  switch (rule.type) {
    case "flat": {
      const value = (base * rule.rate) / 100;
      return {
        value,
        breakdown: [
          { label: `Alíquota única ${rule.rate.toFixed(2)}%`, value },
        ],
      };
    }
    case "progressive": {
      let remaining = base;
      let lastCap = 0;
      let total = 0;
      const breakdown: ItbiCalculation["breakdown"] = [];
      for (const bracket of rule.brackets) {
        const cap = bracket.up_to ?? Infinity;
        const slice = Math.max(0, Math.min(remaining, cap - lastCap));
        if (slice <= 0) {
          lastCap = cap;
          continue;
        }
        const piece = (slice * bracket.rate) / 100;
        total += piece;
        breakdown.push({
          label: `Faixa até ${
            isFinite(cap) ? formatBRL(cap) : "ilimitado"
          } @ ${bracket.rate.toFixed(2)}%`,
          value: piece,
        });
        remaining -= slice;
        lastCap = cap;
        if (remaining <= 0) break;
      }
      return { value: total, breakdown };
    }
    case "financed_split": {
      const financedClamped = Math.max(0, Math.min(financed, base));
      const unfinanced = Math.max(0, base - financedClamped);
      const fin = (financedClamped * rule.rate_financed) / 100;
      const unf = (unfinanced * rule.rate_unfinanced) / 100;
      return {
        value: fin + unf,
        breakdown: [
          {
            label: `Parcela financiada @ ${rule.rate_financed.toFixed(2)}%`,
            value: fin,
          },
          {
            label: `Parcela não financiada @ ${rule.rate_unfinanced.toFixed(2)}%`,
            value: unf,
          },
        ],
      };
    }
    default: {
      // safety net
      return { value: 0, breakdown: [] };
    }
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function describeBase(rule: ItbiRule): string {
  const base = (rule as { base?: string }).base;
  switch (base) {
    case "venal":
      return "Base: valor venal";
    case "maior_entre_venal_e_venda":
      return "Base: maior entre venal e venda";
    case "venda":
    default:
      return "Base: valor de venda";
  }
}
