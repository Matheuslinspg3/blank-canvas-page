import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingDown, DollarSign, Percent, Users } from "lucide-react";
import type { BankSimulationSummary } from "./utils/simulationCalc";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  summaries: BankSimulationSummary[];
  clientIncome: number;
}

export function BankComparisonView({ summaries, clientIncome }: Props) {
  const sorted = useMemo(
    () => [...summaries].sort((a, b) => a.totalPaid - b.totalPaid),
    [summaries]
  );

  if (sorted.length === 0) return null;

  const best = sorted[0];

  return (
    <div className="space-y-4">
      {/* ── Ranked Cards ── */}
      <CardHeader className="px-0 pb-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Ranking dos Bancos (menor custo total)
        </CardTitle>
      </CardHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((s, idx) => {
          const isBest = idx === 0;
          const savings = s.totalPaid - best.totalPaid;
          const incomeOk = clientIncome > 0 && clientIncome >= s.minIncome;

          return (
            <Card
              key={s.bankCode}
              className={
                isBest
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : ""
              }
            >
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{s.bankName}</p>
                  {isBest && (
                    <Badge className="text-[10px] bg-primary text-primary-foreground">
                      Melhor opção
                    </Badge>
                  )}
                  {!isBest && (
                    <Badge variant="outline" className="text-[10px]">
                      #{idx + 1}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Percent className="h-3 w-3" /> Taxa
                  </div>
                  <p className="text-right font-medium">{s.rateUsed.toFixed(2)}% a.a.</p>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <TrendingDown className="h-3 w-3" /> 1ª Parcela
                  </div>
                  <p className="text-right font-medium">{fmtBRL(s.firstPayment)}</p>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-3 w-3" /> Total Pago
                  </div>
                  <p className="text-right font-medium">{fmtBRL(s.totalPaid)}</p>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-3 w-3" /> Total Juros
                  </div>
                  <p className="text-right font-medium">{fmtBRL(s.totalInterest)}</p>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3" /> Renda Mín.
                  </div>
                  <p className="text-right font-medium">{fmtBRL(s.minIncome)}</p>
                </div>

                {!isBest && savings > 0 && (
                  <p className="text-[10px] text-destructive text-center">
                    + {fmtBRL(savings)} vs melhor opção
                  </p>
                )}

                {clientIncome > 0 && (
                  <div className="text-center">
                    <Badge
                      variant={incomeOk ? "default" : "destructive"}
                      className="text-[10px]"
                    >
                      {incomeOk ? "Renda compatível" : "Renda insuficiente"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Comparison Table ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Comparativo Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 px-2">Banco</th>
                  <th className="text-right py-2 px-2">Taxa</th>
                  <th className="text-right py-2 px-2">1ª Parcela</th>
                  <th className="text-right py-2 px-2">Última</th>
                  <th className="text-right py-2 px-2">Total Pago</th>
                  <th className="text-right py-2 px-2">Total Juros</th>
                  <th className="text-right py-2 px-2">Renda Mín.</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, idx) => (
                  <tr
                    key={s.bankCode}
                    className={`border-b border-border/50 ${idx === 0 ? "bg-primary/5 font-medium" : ""}`}
                  >
                    <td className="py-2 px-2 flex items-center gap-1.5">
                      {idx === 0 && <Trophy className="h-3.5 w-3.5 text-primary" />}
                      {s.bankName}
                    </td>
                    <td className="text-right py-2 px-2">{s.rateUsed.toFixed(2)}%</td>
                    <td className="text-right py-2 px-2">{fmtBRL(s.firstPayment)}</td>
                    <td className="text-right py-2 px-2">{fmtBRL(s.lastPayment)}</td>
                    <td className="text-right py-2 px-2">{fmtBRL(s.totalPaid)}</td>
                    <td className="text-right py-2 px-2">{fmtBRL(s.totalInterest)}</td>
                    <td className="text-right py-2 px-2">{fmtBRL(s.minIncome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
