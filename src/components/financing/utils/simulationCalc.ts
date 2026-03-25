import { getAliquotaMIP, ALIQUOTA_DFI_MENSAL } from "@/constants/tabela-mip";
import {
  BANCOS_FINANCIAMENTO,
  COMPROMETIMENTO_MAX_RENDA,
  TETO_SFH,
  type BancoFinanciamento,
} from "@/constants/bancos-financiamento";

/* ── Types ── */

export interface ParcelaMensal {
  mes: number;
  parcela: number;
  amortizacao: number;
  juros: number;
  seguroMIP: number;
  seguroDFI: number;
  taxaAdmin: number;
  saldoDevedor: number;
}

export interface ResultadoSimulacao {
  banco: string;
  bancoId: string;
  cor: string;
  sistema: "SAC" | "PRICE";
  valorImovel: number;
  valorEntrada: number;
  valorFinanciado: number;
  prazoMeses: number;
  taxaAnualNominal: number;
  taxaMensalEfetiva: number;
  trMensal: number;
  primeiraParcela: ParcelaMensal;
  ultimaParcela: ParcelaMensal;
  totalPago: number;
  totalJuros: number;
  totalSeguros: number;
  totalTaxaAdmin: number;
  cetAnualEstimado: number;
  comprometimentoRenda: number;
  aprovado: boolean;
  rendaMinimaExigida: number;
  prazoMaximoIdade: number;
  evolucao: ParcelaMensal[];
}

/* ── Helpers ── */

function taxaMensalBase(taxaAnual: number): number {
  return Math.pow(1 + taxaAnual / 100, 1 / 12) - 1;
}

function taxaMensalEfetiva(taxaAnual: number, trMensal: number): number {
  return taxaMensalBase(taxaAnual) + trMensal / 100;
}

/* ── CET by binary search ── */

function calcularCET(valorFinanciado: number, parcelas: ParcelaMensal[]): number {
  let lo = 0;
  let hi = 0.05; // 5% monthly as upper bound
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    let vp = 0;
    for (let i = 0; i < parcelas.length; i++) {
      vp += parcelas[i].parcela / Math.pow(1 + mid, i + 1);
    }
    if (vp > valorFinanciado) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  const taxaMensal = (lo + hi) / 2;
  return (Math.pow(1 + taxaMensal, 12) - 1) * 100;
}

/* ── Main simulation ── */

export function simularFinanciamento(params: {
  banco: BancoFinanciamento;
  valorImovel: number;
  valorEntrada: number;
  valorFgts: number;
  prazoMeses: number;
  idadeComprador: number;
  rendaMensal: number;
  sistema: "SAC" | "PRICE";
  trMensal: number; // ex: 0.1690
}): ResultadoSimulacao {
  const {
    banco, valorImovel, valorEntrada, valorFgts,
    prazoMeses, idadeComprador, rendaMensal, sistema, trMensal,
  } = params;

  const entradaTotal = valorEntrada + valorFgts;
  const valorFinanciado = Math.max(valorImovel - entradaTotal, 0);
  const taxa = taxaMensalEfetiva(banco.taxaAnual, trMensal);
  const seguroDFI = valorImovel * ALIQUOTA_DFI_MENSAL;
  const prazoMaximoIdade = Math.floor((80.5 - idadeComprador) * 12);

  const evolucao: ParcelaMensal[] = [];
  let saldo = valorFinanciado;
  const n = prazoMeses;

  // Pre-compute PMT for PRICE
  const pmt = sistema === "PRICE" && taxa > 0
    ? valorFinanciado * (taxa * Math.pow(1 + taxa, n)) / (Math.pow(1 + taxa, n) - 1)
    : 0;

  const amortConst = sistema === "SAC" ? valorFinanciado / n : 0;

  for (let i = 1; i <= n; i++) {
    const idadeAtual = idadeComprador + Math.floor((i - 1) / 12);
    const juros = saldo * taxa;
    const mip = saldo * getAliquotaMIP(idadeAtual);

    let amort: number;
    if (sistema === "SAC") {
      amort = amortConst;
    } else {
      amort = pmt - juros;
    }

    const parcelaBase = sistema === "SAC" ? amort + juros : pmt;
    const parcelaTotal = parcelaBase + mip + seguroDFI + banco.taxaAdmin;

    saldo = Math.max(saldo - amort, 0);

    evolucao.push({
      mes: i,
      parcela: parcelaTotal,
      amortizacao: amort,
      juros,
      seguroMIP: mip,
      seguroDFI,
      taxaAdmin: banco.taxaAdmin,
      saldoDevedor: saldo,
    });
  }

  const primeira = evolucao[0];
  const ultima = evolucao[evolucao.length - 1];
  const totalPago = evolucao.reduce((s, p) => s + p.parcela, 0);
  const totalJuros = evolucao.reduce((s, p) => s + p.juros, 0);
  const totalSeguros = evolucao.reduce((s, p) => s + p.seguroMIP + p.seguroDFI, 0);
  const totalTaxaAdmin = evolucao.reduce((s, p) => s + p.taxaAdmin, 0);

  const comprometimentoRenda = rendaMensal > 0 ? primeira.parcela / rendaMensal : 0;
  const rendaMinima = primeira.parcela / COMPROMETIMENTO_MAX_RENDA;
  const aprovado = rendaMensal > 0 && comprometimentoRenda <= COMPROMETIMENTO_MAX_RENDA;

  const cetAnual = calcularCET(valorFinanciado, evolucao);

  return {
    banco: banco.nome,
    bancoId: banco.id,
    cor: banco.cor,
    sistema,
    valorImovel,
    valorEntrada: entradaTotal,
    valorFinanciado,
    prazoMeses,
    taxaAnualNominal: banco.taxaAnual,
    taxaMensalEfetiva: taxa,
    trMensal,
    primeiraParcela: primeira,
    ultimaParcela: ultima,
    totalPago,
    totalJuros,
    totalSeguros,
    totalTaxaAdmin,
    cetAnualEstimado: cetAnual,
    comprometimentoRenda,
    aprovado,
    rendaMinimaExigida: rendaMinima,
    prazoMaximoIdade,
    evolucao,
  };
}

/* ── Simulate all banks ── */

export function simularTodosBancos(params: {
  valorImovel: number;
  valorEntrada: number;
  valorFgts: number;
  prazoMeses: number;
  idadeComprador: number;
  rendaMensal: number;
  sistema: "SAC" | "PRICE";
  trMensal: number;
}): ResultadoSimulacao[] {
  if (params.valorImovel <= 0 || params.valorEntrada >= params.valorImovel) return [];

  return BANCOS_FINANCIAMENTO.map((banco) =>
    simularFinanciamento({ ...params, banco })
  ).sort((a, b) => a.totalPago - b.totalPago);
}
