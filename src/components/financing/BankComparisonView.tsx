import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingDown, DollarSign, Percent, ShieldCheck, Crown } from "lucide-react";
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
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm">Ranking dos Bancos</h3>
        <span className="text-xs text-muted-foreground">• menor custo total</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {resultados.map((r, idx) => {
          const isBest = idx === 0;
          const savings = r.totalPago - best.totalPago;
          const isSelected = (selectedBankId ?? best.bancoId) === r.bancoId;

          return (
            <Card
              key={r.bancoId}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md relative overflow-hidden ${
                isSelected
                  ? "ring-2 ring-primary shadow-lg"
                  : "hover:ring-1 hover:ring-primary/30"
              }`}
              onClick={() => onSelectBank(r.bancoId)}
            >
              {/* Top color bar */}
              <div className="h-1 w-full" style={{ backgroundColor: r.cor }} />

              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ backgroundColor: r.cor }}
                    >
                      {isBest ? <Crown className="h-4 w-4" /> : `#${idx + 1}`}
                    </div>
                    <div>
                      <p className="font-semibold text-sm leading-tight">{r.banco}</p>
                      <p className="text-[10px] text-muted-foreground">{r.taxaAnualNominal.toFixed(2)}% a.a. + TR</p>
                    </div>
                  </div>
                  {isBest && (
                    <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30" variant="outline">
                      Melhor
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" /> 1ª Parcela
                    </p>
                    <p className="font-bold text-sm mt-0.5">{fmtBRL(r.primeiraParcela.parcela)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> CET
                    </p>
                    <p className="font-bold text-sm mt-0.5">{r.cetAnualEstimado.toFixed(2)}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Total pago</span>
                  <span className="font-semibold">{fmtBRL(r.totalPago)}</span>
                </div>

                {!isBest && savings > 0 && (
                  <p className="text-[10px] text-destructive text-center bg-destructive/5 rounded-md py-1">
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
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Comparativo Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2.5 px-2 text-muted-foreground font-medium">Banco</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium">Taxa</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium">CET</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium">1ª Parcela</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium">Última</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium">Total</th>
                  <th className="text-right py-2.5 px-2 text-muted-foreground font-medium">Juros</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((r, idx) => (
                  <tr
                    key={r.bancoId}
                    className={`border-b border-border/40 cursor-pointer transition-colors hover:bg-muted/50 ${
                      idx === 0 ? "bg-primary/5" : ""
                    }`}
                    onClick={() => onSelectBank(r.bancoId)}
                  >
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.cor }} />
                        <span className={idx === 0 ? "font-semibold" : ""}>{r.banco}</span>
                        {idx === 0 && <Trophy className="h-3 w-3 text-primary" />}
                      </div>
                    </td>
                    <td className="text-right py-2.5 px-2">{r.taxaAnualNominal.toFixed(2)}%</td>
                    <td className="text-right py-2.5 px-2 font-medium">{r.cetAnualEstimado.toFixed(2)}%</td>
                    <td className="text-right py-2.5 px-2">{fmtBRL(r.primeiraParcela.parcela)}</td>
                    <td className="text-right py-2.5 px-2">{fmtBRL(r.ultimaParcela.parcela)}</td>
                    <td className="text-right py-2.5 px-2 font-medium">{fmtBRL(r.totalPago)}</td>
                    <td className="text-right py-2.5 px-2 text-muted-foreground">{fmtBRL(r.totalJuros)}</td>
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
