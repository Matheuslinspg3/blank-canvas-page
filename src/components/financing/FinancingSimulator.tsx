import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface SimulationResult {
  parcela: number;
  amortizacao: number;
  juros: number;
  saldoDevedor: number;
}

const BANKS = [
  { id: "caixa", name: "Caixa Econômica", taxMin: 8.99, taxMax: 11.49 },
  { id: "bb", name: "Banco do Brasil", taxMin: 9.39, taxMax: 11.69 },
  { id: "itau", name: "Itaú", taxMin: 9.5, taxMax: 11.59 },
  { id: "bradesco", name: "Bradesco", taxMin: 9.5, taxMax: 11.9 },
  { id: "santander", name: "Santander", taxMin: 9.49, taxMax: 11.99 },
  { id: "custom", name: "Taxa personalizada", taxMin: 0, taxMax: 0 },
];

export function FinancingSimulator() {
  const [propertyValue, setPropertyValue] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [termMonths, setTermMonths] = useState("360");
  const [annualRate, setAnnualRate] = useState("9.99");
  const [bank, setBank] = useState("caixa");
  const [system, setSystem] = useState<"sac" | "price">("sac");

  const financedAmount = useMemo(() => {
    const pv = parseFloat(propertyValue.replace(/\D/g, "")) || 0;
    const dp = parseFloat(downPayment.replace(/\D/g, "")) || 0;
    return Math.max(pv - dp, 0);
  }, [propertyValue, downPayment]);

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
      const pmt = financedAmount * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
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

  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleBankChange = (bankId: string) => {
    setBank(bankId);
    const b = BANKS.find((x) => x.id === bankId);
    if (b && bankId !== "custom") setAnnualRate(b.taxMin.toString());
  };

  return (
    <div className="space-y-6">
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
              <Label>Entrada (R$)</Label>
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
                  {BANKS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} {b.id !== "custom" && `(${b.taxMin}% ~ ${b.taxMax}%)`}
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
        </CardContent>
      </Card>

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                <DollarSign className="h-5 w-5 mx-auto text-destructive mb-1" />
                <p className="text-xs text-muted-foreground">Total Juros</p>
                <p className="text-lg font-bold">{fmtBRL(totalInterest)}</p>
              </CardContent>
            </Card>
          </div>

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
