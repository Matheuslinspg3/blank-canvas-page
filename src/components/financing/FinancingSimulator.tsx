import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calculator, TrendingDown, TrendingUp, DollarSign,
  Users, AlertTriangle, CheckCircle2, Percent, Wifi, WifiOff,
} from "lucide-react";
import { useSelicRate } from "@/hooks/financing/useSelicRate";
import { useBankRates, DEFAULT_BANK_RATES } from "@/hooks/financing/useBankRates";

interface SimulationResult {
  parcela: number;
  amortizacao: number;
  juros: number;
  saldoDevedor: number;
}

const ITBI_RATES: Record<string, number> = {
  SP: 3, RJ: 3, MG: 3, PR: 2.5, SC: 2, RS: 3, BA: 3, PE: 2, CE: 2, DF: 3,
  GO: 2.5, ES: 2, MA: 2, PA: 2, MT: 2, MS: 2, RN: 3, PB: 3, AL: 2, SE: 2,
  PI: 2, RO: 2, TO: 2, AC: 2, AM: 2, AP: 2, RR: 2,
};

const INCOME_COMMITMENT_RATIO = 0.30;

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FinancingSimulator() {
  const [propertyValue, setPropertyValue] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [termMonths, setTermMonths] = useState("360");
  const [annualRate, setAnnualRate] = useState("9.99");
  const [bank, setBank] = useState("caixa");
  const [system, setSystem] = useState<"sac" | "price">("sac");
  const [clientIncome, setClientIncome] = useState("");
  const [state, setState] = useState("SP");

  // ─── Enriched data sources ───
  const { data: selicRate, isLoading: selicLoading, isError: selicError } = useSelicRate();
  const { data: bankRates, isLoading: ratesLoading } = useBankRates();

  const banks = useMemo(() => {
    const list = bankRates ?? DEFAULT_BANK_RATES.map((r, i) => ({ ...r, id: `default-${i}` }));
    return [
      ...list,
      { id: "custom", bank_name: "Taxa personalizada", bank_code: "custom", rate_min: 0, rate_max: 0, spread_over_selic: 0, max_ltv: 100, max_term_months: 420, notes: null, is_active: true },
    ];
  }, [bankRates]);

  const selectedBank = useMemo(
    () => banks.find((b) => b.bank_code === bank) ?? banks[0],
    [banks, bank]
  );

  // ─── Computed values ───
  const propertyValueNum = useMemo(
    () => parseFloat(propertyValue.replace(/\D/g, "")) || 0,
    [propertyValue]
  );

  const financedAmount = useMemo(() => {
    const dp = parseFloat(downPayment.replace(/\D/g, "")) || 0;
    return Math.max(propertyValueNum - dp, 0);
  }, [propertyValueNum, downPayment]);

  const monthlyRate = useMemo(() => {
    const annual = parseFloat(annualRate) || 0;
    return Math.pow(1 + annual / 100, 1 / 12) - 1;
  }, [annualRate]);

  const results = useMemo((): SimulationResult[] => {
    if (financedAmount <= 0 || monthlyRate <= 0) return [];
    const n = parseInt(termMonths) || 360;
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
  }, [financedAmount, monthlyRate, termMonths, system]);

  const firstPayment = results[0]?.parcela ?? 0;
  const lastPayment = results[results.length - 1]?.parcela ?? 0;
  const totalPaid = results.reduce((s, r) => s + r.parcela, 0);
  const totalInterest = results.reduce((s, r) => s + r.juros, 0);

  const minIncome = useMemo(
    () => (firstPayment > 0 ? firstPayment / INCOME_COMMITMENT_RATIO : 0),
    [firstPayment]
  );

  const clientIncomeNum = useMemo(
    () => parseFloat(clientIncome.replace(/\D/g, "")) || 0,
    [clientIncome]
  );

  const incomeOk = clientIncomeNum > 0 && clientIncomeNum >= minIncome;
  const incomeRatio =
    clientIncomeNum > 0 && firstPayment > 0
      ? (firstPayment / clientIncomeNum) * 100
      : 0;

  const itbiRate = ITBI_RATES[state] ?? 3;
  const itbiValue = propertyValueNum * (itbiRate / 100);
  const registroEstimado = propertyValueNum > 0 ? Math.max(propertyValueNum * 0.012, 1500) : 0;
  const totalCustos = itbiValue + registroEstimado;

  const downPaymentPct =
    propertyValueNum > 0
      ? ((parseFloat(downPayment.replace(/\D/g, "")) || 0) / propertyValueNum) * 100
      : 0;

  const handleBankChange = (bankCode: string) => {
    setBank(bankCode);
    const b = banks.find((x) => x.bank_code === bankCode);
    if (b && bankCode !== "custom") {
      // If bank has spread_over_selic and we have Selic, calculate effective rate
      if (b.spread_over_selic > 0 && selicRate) {
        setAnnualRate((selicRate + b.spread_over_selic).toFixed(2));
      } else {
        setAnnualRate(b.rate_min.toString());
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Selic indicator ─── */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {selicLoading ? (
          <Skeleton className="h-4 w-40" />
        ) : selicError ? (
          <>
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
            <span>Selic indisponível — usando taxas fixas</span>
          </>
        ) : (
          <>
            <Wifi className="h-3.5 w-3.5 text-green-500" />
            <span>Selic atual: <strong>{selicRate?.toFixed(2)}% a.a.</strong> (BCB)</span>
            {ratesLoading ? (
              <Skeleton className="h-4 w-24" />
            ) : bankRates && bankRates[0]?.id !== "default-0" ? (
              <Badge variant="outline" className="text-[10px]">Taxas personalizadas</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">Taxas padrão</Badge>
            )}
          </>
        )}
      </div>

      {/* ─── Input Form ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Simulador de Financiamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Valor do imóvel (R$)</Label>
              <Input
                placeholder="500.000"
                value={propertyValue}
                onChange={(e) => setPropertyValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                Entrada (R$)
                {downPaymentPct > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({downPaymentPct.toFixed(1)}%)
                  </span>
                )}
              </Label>
              <Input
                placeholder="100.000"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo (meses)</Label>
              <Select value={termMonths} onValueChange={setTermMonths}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[60, 120, 180, 240, 300, 360, 420].map((m) => (
                    <SelectItem key={m} value={m.toString()}>
                      {m} meses ({(m / 12).toFixed(0)} anos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Banco</Label>
              <Select value={bank} onValueChange={handleBankChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.bank_code} value={b.bank_code}>
                      {b.bank_name} {b.bank_code !== "custom" && `(${b.rate_min}% ~ ${b.rate_max}%)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Taxa anual (%)</Label>
              <Input
                value={annualRate}
                onChange={(e) => setAnnualRate(e.target.value)}
                disabled={bank !== "custom"}
              />
            </div>
            <div className="space-y-2">
              <Label>Sistema</Label>
              <Tabs value={system} onValueChange={(v) => setSystem(v as "sac" | "price")}>
                <TabsList className="w-full">
                  <TabsTrigger value="sac" className="flex-1">SAC</TabsTrigger>
                  <TabsTrigger value="price" className="flex-1">PRICE</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Renda bruta do cliente (R$)
              </Label>
              <Input
                placeholder="8.000"
                value={clientIncome}
                onChange={(e) => setClientIncome(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estado (para ITBI)</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(ITBI_RATES).sort().map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf} ({ITBI_RATES[uf]}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Results ─── */}
      {results.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="pt-4 text-center">
                <TrendingDown className="h-5 w-5 mx-auto text-green-500 mb-1" />
                <p className="text-xs text-muted-foreground">1ª Parcela</p>
                <p className="text-lg font-bold">{fmtBRL(firstPayment)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-orange-500 mb-1" />
                <p className="text-xs text-muted-foreground">Última Parcela</p>
                <p className="text-lg font-bold">{fmtBRL(lastPayment)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <DollarSign className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-xs text-muted-foreground">Total Pago</p>
                <p className="text-lg font-bold">{fmtBRL(totalPaid)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <Percent className="h-5 w-5 mx-auto text-destructive mb-1" />
                <p className="text-xs text-muted-foreground">Total Juros</p>
                <p className="text-lg font-bold">{fmtBRL(totalInterest)}</p>
              </CardContent>
            </Card>
            <Card className="border-primary/30">
              <CardContent className="pt-4 text-center">
                <Users className="h-5 w-5 mx-auto text-primary mb-1" />
                <p className="text-xs text-muted-foreground">Renda Mínima</p>
                <p className="text-lg font-bold">{fmtBRL(minIncome)}</p>
                <p className="text-[10px] text-muted-foreground">30% comprometimento</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <DollarSign className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">ITBI + Registro</p>
                <p className="text-lg font-bold">{fmtBRL(totalCustos)}</p>
                <p className="text-[10px] text-muted-foreground">
                  ITBI {fmtBRL(itbiValue)} · Reg. {fmtBRL(registroEstimado)}
                </p>
              </CardContent>
            </Card>
          </div>

          {clientIncomeNum > 0 && (
            <Card className={incomeOk ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}>
              <CardContent className="pt-4 flex items-center gap-3">
                {incomeOk ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {incomeOk
                      ? "Renda compatível com o financiamento"
                      : "Renda insuficiente para este financiamento"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A parcela compromete <span className="font-semibold">{incomeRatio.toFixed(1)}%</span> da renda.
                    {!incomeOk && (
                      <> Faltam <span className="font-semibold">{fmtBRL(minIncome - clientIncomeNum)}</span> para atingir a renda mínima de {fmtBRL(minIncome)}.</>
                    )}
                  </p>
                </div>
                <Badge variant={incomeOk ? "default" : "destructive"} className="shrink-0">
                  {incomeRatio.toFixed(0)}%
                </Badge>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tabela de Amortização (primeiras 12 parcelas)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-right py-2 px-2">Parcela</th>
                      <th className="text-right py-2 px-2">Amortização</th>
                      <th className="text-right py-2 px-2">Juros</th>
                      <th className="text-right py-2 px-2">Saldo Devedor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.slice(0, 12).map((r, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-2">{i + 1}</td>
                        <td className="text-right py-2 px-2">{fmtBRL(r.parcela)}</td>
                        <td className="text-right py-2 px-2">{fmtBRL(r.amortizacao)}</td>
                        <td className="text-right py-2 px-2">{fmtBRL(r.juros)}</td>
                        <td className="text-right py-2 px-2">{fmtBRL(r.saldoDevedor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
