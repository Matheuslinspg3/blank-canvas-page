export interface SimulationResult {
  parcela: number;
  amortizacao: number;
  juros: number;
  saldoDevedor: number;
}

export interface BankSimulationSummary {
  bankCode: string;
  bankName: string;
  rateUsed: number;
  firstPayment: number;
  lastPayment: number;
  totalPaid: number;
  totalInterest: number;
  minIncome: number;
  rows: SimulationResult[];
}

const INCOME_COMMITMENT_RATIO = 0.30;

export function simulateFinancing(
  financedAmount: number,
  annualRate: number,
  termMonths: number,
  system: "sac" | "price"
): SimulationResult[] {
  const monthlyRate = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  if (financedAmount <= 0 || monthlyRate <= 0) return [];

  const n = termMonths;
  const rows: SimulationResult[] = [];
  let saldo = financedAmount;

  if (system === "sac") {
    const amortConst = financedAmount / n;
    for (let i = 1; i <= n; i++) {
      const juros = saldo * monthlyRate;
      const parcela = amortConst + juros;
      saldo -= amortConst;
      rows.push({ parcela, amortizacao: amortConst, juros, saldoDevedor: Math.max(saldo, 0) });
    }
  } else {
    const pmt =
      financedAmount *
      (monthlyRate * Math.pow(1 + monthlyRate, n)) /
      (Math.pow(1 + monthlyRate, n) - 1);
    for (let i = 1; i <= n; i++) {
      const juros = saldo * monthlyRate;
      const amort = pmt - juros;
      saldo -= amort;
      rows.push({ parcela: pmt, amortizacao: amort, juros, saldoDevedor: Math.max(saldo, 0) });
    }
  }
  return rows;
}

export function buildBankSummary(
  bankCode: string,
  bankName: string,
  rate: number,
  financedAmount: number,
  termMonths: number,
  system: "sac" | "price"
): BankSimulationSummary {
  const rows = simulateFinancing(financedAmount, rate, termMonths, system);
  const firstPayment = rows[0]?.parcela ?? 0;
  const lastPayment = rows[rows.length - 1]?.parcela ?? 0;
  const totalPaid = rows.reduce((s, r) => s + r.parcela, 0);
  const totalInterest = rows.reduce((s, r) => s + r.juros, 0);
  const minIncome = firstPayment > 0 ? firstPayment / INCOME_COMMITMENT_RATIO : 0;

  return {
    bankCode,
    bankName,
    rateUsed: rate,
    firstPayment,
    lastPayment,
    totalPaid,
    totalInterest,
    minIncome,
    rows,
  };
}
