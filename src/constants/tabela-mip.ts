/** Tabela de alíquotas do seguro MIP (Morte e Invalidez Permanente) por faixa etária.
 *  Alíquota mensal aplicada sobre o saldo devedor.
 *  Baseada nos valores praticados pela Caixa (SBPE/SFH). */
export const TABELA_MIP: { idadeMin: number; idadeMax: number; aliquota: number }[] = [
  { idadeMin: 18, idadeMax: 25, aliquota: 0.000180 },
  { idadeMin: 26, idadeMax: 30, aliquota: 0.000200 },
  { idadeMin: 31, idadeMax: 35, aliquota: 0.000250 },
  { idadeMin: 36, idadeMax: 40, aliquota: 0.000350 },
  { idadeMin: 41, idadeMax: 45, aliquota: 0.000500 },
  { idadeMin: 46, idadeMax: 50, aliquota: 0.000700 },
  { idadeMin: 51, idadeMax: 55, aliquota: 0.001000 },
  { idadeMin: 56, idadeMax: 60, aliquota: 0.001400 },
  { idadeMin: 61, idadeMax: 65, aliquota: 0.001800 },
  { idadeMin: 66, idadeMax: 70, aliquota: 0.002000 },
  { idadeMin: 71, idadeMax: 80, aliquota: 0.002000 },
];

export function getAliquotaMIP(idade: number): number {
  const faixa = TABELA_MIP.find(f => idade >= f.idadeMin && idade <= f.idadeMax);
  return faixa?.aliquota ?? 0.001000;
}

/** DFI (Danos Físicos ao Imóvel) — alíquota fixa mensal sobre valor do imóvel */
export const ALIQUOTA_DFI_MENSAL = 0.0001337;
