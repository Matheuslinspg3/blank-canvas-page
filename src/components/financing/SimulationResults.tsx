import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign, TrendingDown, TrendingUp, Percent, ShieldCheck,
  FileText, AlertTriangle, ChevronDown, ChevronUp, Download,
} from "lucide-react";
import { gerarPdfSimulacao } from "./SimulationPdfGenerator";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { ResultadoSimulacao } from "./utils/simulationCalc";
import { COMPROMETIMENTO_MAX_RENDA } from "@/constants/bancos-financiamento";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

interface Props {
  resultado: ResultadoSimulacao;
  itbiRate: number;
  itbiValue: number;
  state: string;
}

export function SimulationResults({ resultado: r, itbiRate, itbiValue, state }: Props) {
  const [showAllRows, setShowAllRows] = useState(false);

  const pieData = useMemo(() => [
    { name: "Amortização", value: r.primeiraParcela.amortizacao },
    { name: "Juros", value: r.primeiraParcela.juros },
    { name: "Seguro MIP", value: r.primeiraParcela.seguroMIP },
    { name: "Seguro DFI", value: r.primeiraParcela.seguroDFI },
    { name: "Taxa Admin", value: r.primeiraParcela.taxaAdmin },
  ], [r]);

  const displayedRows = useMemo(() => {
    if (showAllRows) return r.evolucao;
    const rows: typeof r.evolucao = [];
    // First 12 months
    r.evolucao.slice(0, 12).forEach(p => rows.push(p));
    // Every 60 months (5 years)
    for (let i = 59; i < r.evolucao.length - 1; i += 60) {
      if (i >= 12) rows.push(r.evolucao[i]);
    }
    // Last month
    const last = r.evolucao[r.evolucao.length - 1];
    if (last && last.mes > 12) rows.push(last);
    return rows;
  }, [r.evolucao, showAllRows]);

  const comprPct = Math.min(r.comprometimentoRenda * 100, 100);

  // Custos extras
  const escritura = r.valorImovel * 0.0075;
  const registro = r.valorImovel * 0.004;
  const avaliacao = 2500;
  const totalCustosExtras = itbiValue + escritura + registro + avaliacao;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: r.cor }} />
          {r.banco} — Resultado Detalhado ({r.sistema})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="resumo">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="evolucao">Evolução</TabsTrigger>
            <TabsTrigger value="renda">Renda</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
          </TabsList>

          {/* ── Resumo ── */}
          <TabsContent value="resumo" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "1ª Parcela", value: fmtBRL(r.primeiraParcela.parcela), icon: TrendingDown },
                { label: "Última Parcela", value: fmtBRL(r.ultimaParcela.parcela), icon: TrendingUp },
                { label: "Total Pago", value: fmtBRL(r.totalPago), icon: DollarSign },
                { label: "Total Juros", value: fmtBRL(r.totalJuros), icon: Percent },
                { label: "Total Seguros", value: fmtBRL(r.totalSeguros), icon: ShieldCheck },
                { label: "CET Estimado", value: `${r.cetAnualEstimado.toFixed(2)}% a.a.`, icon: FileText },
              ].map(({ label, value, icon: Icon }) => (
                <Card key={label} className="p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
                    <Icon className="h-3 w-3" />{label}
                  </div>
                  <p className="font-semibold text-sm">{value}</p>
                </Card>
              ))}
            </div>

            {/* Donut chart */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <p className="text-xs font-medium mb-2">Composição da 1ª Parcela</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {pieData.map((d, i) => (
                    <Badge key={d.name} variant="outline" className="text-[10px] gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                      {d.name}: {fmtBRL(d.value)}
                    </Badge>
                  ))}
                </div>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-medium mb-2">Composição do Custo Total</p>
                <div className="space-y-3 mt-4">
                  {[
                    { label: "Principal", value: r.valorFinanciado, color: COLORS[0] },
                    { label: "Juros", value: r.totalJuros, color: COLORS[1] },
                    { label: "Seguros", value: r.totalSeguros, color: COLORS[2] },
                    { label: "Taxas Admin", value: r.totalTaxaAdmin, color: COLORS[4] },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{fmtBRL(value)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(value / r.totalPago) * 100}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ── Evolução ── */}
          <TabsContent value="evolucao" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 px-1">Mês</th>
                    <th className="text-right py-2 px-1">Parcela</th>
                    <th className="text-right py-2 px-1">Amort.</th>
                    <th className="text-right py-2 px-1">Juros</th>
                    <th className="text-right py-2 px-1">MIP</th>
                    <th className="text-right py-2 px-1">DFI</th>
                    <th className="text-right py-2 px-1">Admin</th>
                    <th className="text-right py-2 px-1">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((p) => (
                    <tr key={p.mes} className="border-b border-border/30">
                      <td className="py-1.5 px-1 font-medium">{p.mes}</td>
                      <td className="text-right py-1.5 px-1">{fmtBRL(p.parcela)}</td>
                      <td className="text-right py-1.5 px-1">{fmtBRL(p.amortizacao)}</td>
                      <td className="text-right py-1.5 px-1">{fmtBRL(p.juros)}</td>
                      <td className="text-right py-1.5 px-1">{fmtBRL(p.seguroMIP)}</td>
                      <td className="text-right py-1.5 px-1">{fmtBRL(p.seguroDFI)}</td>
                      <td className="text-right py-1.5 px-1">{fmtBRL(p.taxaAdmin)}</td>
                      <td className="text-right py-1.5 px-1">{fmtBRL(p.saldoDevedor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              variant="ghost" size="sm" className="w-full mt-2 gap-1"
              onClick={() => setShowAllRows(!showAllRows)}
            >
              {showAllRows ? <><ChevronUp className="h-3 w-3" /> Mostrar resumo</> : <><ChevronDown className="h-3 w-3" /> Ver todos os {r.evolucao.length} meses</>}
            </Button>
          </TabsContent>

          {/* ── Renda ── */}
          <TabsContent value="renda" className="mt-4 space-y-4">
            <Card className="p-4 space-y-3">
              <p className="text-xs font-medium">Comprometimento de Renda</p>
              <div className="relative">
                <Progress value={comprPct} className="h-4" />
                <div className="absolute top-0 left-[30%] h-4 w-0.5 bg-destructive" title="Limite 30%" />
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{comprPct.toFixed(1)}% da renda</span>
                <span className="text-muted-foreground">Limite: {(COMPROMETIMENTO_MAX_RENDA * 100)}%</span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs mt-2">
                <div>
                  <p className="text-muted-foreground">Renda bruta</p>
                  <p className="font-semibold">{fmtBRL(r.primeiraParcela.parcela / r.comprometimentoRenda || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Limite 30%</p>
                  <p className="font-semibold">{fmtBRL((r.primeiraParcela.parcela / r.comprometimentoRenda || 0) * COMPROMETIMENTO_MAX_RENDA)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">1ª Parcela</p>
                  <p className="font-semibold">{fmtBRL(r.primeiraParcela.parcela)}</p>
                </div>
              </div>

              {!r.aprovado && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1">
                      <p className="font-medium text-destructive">Renda insuficiente</p>
                      <p>Renda mínima exigida: <strong>{fmtBRL(r.rendaMinimaExigida)}</strong></p>
                      <p className="text-muted-foreground">Sugestões: aumentar a entrada, reduzir o prazo, ou compor renda com outro participante.</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ── Custos Extras ── */}
          <TabsContent value="custos" className="mt-4 space-y-3">
            <Card className="p-4">
              <p className="text-xs font-medium mb-3">Custos Estimados de Aquisição ({state})</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: `ITBI (${itbiRate}%)`, value: itbiValue },
                  { label: "Escritura (~0,75%)", value: escritura },
                  { label: "Registro (~0,4%)", value: registro },
                  { label: "Avaliação do imóvel", value: avaliacao },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{fmtBRL(value)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total estimado</span>
                  <span>{fmtBRL(totalCustosExtras)}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3">
                * Valores estimados. Consulte o cartório e prefeitura para valores exatos.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
