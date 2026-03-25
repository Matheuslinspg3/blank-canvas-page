export const BANCOS_FINANCIAMENTO = [
  { id: "caixa", nome: "Caixa Econômica", taxaAnual: 11.19, taxaAdmin: 25, cor: "#005CA9" },
  { id: "brb", nome: "BRB", taxaAnual: 11.36, taxaAdmin: 25, cor: "#006633" },
  { id: "itau", nome: "Itaú", taxaAnual: 11.60, taxaAdmin: 25, cor: "#FF6600" },
  { id: "santander", nome: "Santander", taxaAnual: 11.69, taxaAdmin: 25, cor: "#CC0000" },
  { id: "bradesco", nome: "Bradesco", taxaAnual: 11.70, taxaAdmin: 25, cor: "#CC092F" },
  { id: "bb", nome: "Banco do Brasil", taxaAnual: 12.00, taxaAdmin: 25, cor: "#FFCC00" },
] as const;

export type BancoFinanciamento = (typeof BANCOS_FINANCIAMENTO)[number];

export const TETO_SFH = 2_250_000;
export const FINANCIAMENTO_MAX_PERC = 0.80;
export const COMPROMETIMENTO_MAX_RENDA = 0.30;
export const PRAZO_MAX_MESES = 420; // 35 anos
export const IDADE_MAX_FIM_CONTRATO = 80.5; // 80 anos e 6 meses

export const ITBI_RATES: Record<string, number> = {
  SP: 3, RJ: 3, MG: 3, PR: 2.5, SC: 2, RS: 3, BA: 3, PE: 2, CE: 2, DF: 3,
  GO: 2.5, ES: 2, MA: 2, PA: 2, MT: 2, MS: 2, RN: 3, PB: 3, AL: 2, SE: 2,
  PI: 2, RO: 2, TO: 2, AC: 2, AM: 2, AP: 2, RR: 2,
};
