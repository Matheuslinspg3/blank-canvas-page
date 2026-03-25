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
  Calculator, Users, Wifi, WifiOff, DollarSign,
} from "lucide-react";
import { useSelicRate } from "@/hooks/financing/useSelicRate";
import { useBankRates, DEFAULT_BANK_RATES } from "@/hooks/financing/useBankRates";
import { buildBankSummary } from "./utils/simulationCalc";
import { BankComparisonView } from "./BankComparisonView";

const ITBI_RATES: Record<string, number> = {
  SP: 3, RJ: 3, MG: 3, PR: 2.5, SC: 2, RS: 3, BA: 3, PE: 2, CE: 2, DF: 3,
  GO: 2.5, ES: 2, MA: 2, PA: 2, MT: 2, MS: 2, RN: 3, PB: 3, AL: 2, SE: 2,
  PI: 2, RO: 2, TO: 2, AC: 2, AM: 2, AP: 2, RR: 2,
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FinancingSimulator() {
  const [propertyValue, setPropertyValue] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [termMonths, setTermMonths] = useState("360");
  const [system, setSystem] = useState<"sac" | "price">("sac");
  const [clientIncome, setClientIncome] = useState("");
  const [state, setState] = useState("SP");

  // ─── Enriched data sources ───
  const { data: selicRate, isLoading: selicLoading, isError: selicError } = useSelicRate();
  const { data: bankRates, isLoading: ratesLoading } = useBankRates();

  const banks = useMemo(() => {
    return bankRates ?? DEFAULT_BANK_RATES.map((r, i) => ({ ...r, id: `default-${i}` }));
  }, [bankRates]);

  // ─── Computed values ───
  const propertyValueNum = useMemo(
    () => parseFloat(propertyValue.replace(/\D/g, "")) || 0,
    [propertyValue]
  );

  const financedAmount = useMemo(() => {
    const dp = parseFloat(downPayment.replace(/\D/g, "")) || 0;
    return Math.max(propertyValueNum - dp, 0);
  }, [propertyValueNum, downPayment]);

  const clientIncomeNum = useMemo(
    () => parseFloat(clientIncome.replace(/\D/g, "")) || 0,
    [clientIncome]
  );

  const downPaymentPct =
    propertyValueNum > 0
      ? ((parseFloat(downPayment.replace(/\D/g, "")) || 0) / propertyValueNum) * 100
      : 0;

  // ─── Multi-bank simulation ───
  const bankSummaries = useMemo(() => {
    if (financedAmount <= 0) return [];
    const n = parseInt(termMonths) || 360;

    return banks.map((b) => {
      const effectiveRate =
        b.spread_over_selic > 0 && selicRate
          ? selicRate + b.spread_over_selic
          : b.rate_min;

      return buildBankSummary(
        b.bank_code,
        b.bank_name,
        effectiveRate,
        financedAmount,
        n,
        system
      );
    });
  }, [banks, financedAmount, termMonths, system, selicRate]);

  // ─── ITBI / Custos ───
  const itbiRate = ITBI_RATES[state] ?? 3;
  const itbiValue = propertyValueNum * (itbiRate / 100);
  const registroEstimado = propertyValueNum > 0 ? Math.max(propertyValueNum * 0.012, 1500) : 0;
  const totalCustos = itbiValue + registroEstimado;

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
            Simulador de Financiamento — Todos os Bancos
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
              <Label>Sistema</Label>
              <Tabs value={system} onValueChange={(v) => setSystem(v as "sac" | "price")}>
                <TabsList className="w-full">
                  <TabsTrigger value="sac" className="flex-1">SAC</TabsTrigger>
                  <TabsTrigger value="price" className="flex-1">PRICE</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
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

          {/* ─── Custos extras ─── */}
          {propertyValueNum > 0 && (
            <>
              <Separator className="my-4" />
              <div className="flex items-center gap-4 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Custos estimados:</span>
                <span className="font-medium">
                  ITBI {fmtBRL(itbiValue)} + Registro {fmtBRL(registroEstimado)} = <strong>{fmtBRL(totalCustos)}</strong>
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Multi-bank Results ─── */}
      {bankSummaries.length > 0 && (
        <BankComparisonView
          summaries={bankSummaries}
          clientIncome={clientIncomeNum}
        />
      )}
    </div>
  );
}
