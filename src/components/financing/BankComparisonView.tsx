import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingDown, DollarSign, Percent, ShieldCheck } from "lucide-react";
import type { ResultadoSimulacao } from "./utils/simulationCalc";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  resultados: ResultadoSimulacao[];
  selectedBankId: string | null;
  onSelectBank: (id: string) => void;
}

export function BankComparisonView({ resultados, selectedBankId, onSelectBank }: Props) {
  if (resultados.length === 0) return null;

  const best = resultados[0];

  return (
    <div className="space-y-4">
      <CardHeader className="px-0 pb-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Ranking dos Bancos (menor custo total)
        </CardTitle>
      </CardHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {resultados.map((r, idx) => {
          const isBest = idx === 0;
          const savings = r.totalPago - best.totalPago;
          const isSelected = (selectedBankId ?? best.bancoId) === r.bancoId;

          return (
            <Card
              key={r.bancoId}
              className={`cursor-pointer transition-all hover:ring-1 hover:ring-primary/30 ${
                isSelected ? "ring-2 ring-primary bg-primary/5" : ""
              } ${isBest ? "border-primary" : ""}`}
              onClick={() => onSelectBank(r.bancoId)}
            >
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: r.cor }}
                    />
                    <p className="font-semibold text-sm">{r.banco}</p>
                  </div>
                  {isBest && (
                    <Badge className="text-[10px] bg-primary text-primary-foreground">
                      Melhor opção
                    </Badge>
                  )}
                  {!isBest && (
                    <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Percent className="h-3 w-3" /> Taxa
                  </div>
                  <p className="text-right font-medium">{r.taxaAnualNominal.toFixed(2)}% + TR</p>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <TrendingDown className="h-3 w-3" /> 1ª Parcela
                  </div>
                  <p className="text-right font-medium">{fmtBRL(r.primeiraParcela.parcela)}</p>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-3 w-3" /> Total Pago
                  </div>
                  <p className="text-right font-medium">{fmtBRL(r.totalPago)}</p>

                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ShieldCheck className="h-3 w-3" /> CET
                  </div>
                  <p className="text-right font-medium">{r.cetAnualEstimado.toFixed(2)}% a.a.</p>
                </div>

                {!isBest && savings > 0 && (
                  <p className="text-[10px] text-destructive text-center">
                    + {fmtBRL(savings)} vs melhor opção
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Comparison Table */}
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
                  <th className="text-right py-2 px-2">CET</th>
                  <th className="text-right py-2 px-2">1ª Parcela</th>
                  <th className="text-right py-2 px-2">Última</th>
                  <th className="text-right py-2 px-2">Total Pago</th>
                  <th className="text-right py-2 px-2">Total Juros</th>
                  <th className="text-right py-2 px-2">Total Seguros</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, idx) => (
                  <tr
                    key={r.bancoId}
                    className={`border-b border-border/50 cursor-pointer hover:bg-muted/50 ${
                      idx === 0 ? "bg-primary/5 font-medium" : ""
                    }`}
                    onClick={() => onSelectBank(r.bancoId)}
                  >
                    <td className="py-2 px-2 flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.cor }} />
                      {idx === 0 && <Trophy className="h-3.5 w-3.5 text-primary" />}
                      {r.banco}
                    </td>
                    <td className="text-right py-2 px-2">{r.taxaAnualNominal.toFixed(2)}%</td>
                    <td className="text-right py-2 px-2">{r.cetAnualEstimado.toFixed(2)}%</td>
                    <td className="text-right py-2 px-2">{fmtBRL(r.primeiraParcela.parcela)}</td>
                    <td className="text-right py-2 px-2">{fmtBRL(r.ultimaParcela.parcela)}</td>
                    <td className="text-right py-2 px-2">{fmtBRL(r.totalPago)}</td>
                    <td className="text-right py-2 px-2">{fmtBRL(r.totalJuros)}</td>
                    <td className="text-right py-2 px-2">{fmtBRL(r.totalSeguros)}</td>
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
