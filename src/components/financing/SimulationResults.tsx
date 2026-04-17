import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign, TrendingDown, TrendingUp, Percent, ShieldCheck,
  FileText, AlertTriangle, ChevronDown, ChevronUp, Download,
  BarChart3, Wallet, Receipt, Scale,
} from "lucide-react";
import { gerarPdfSimulacao } from "./SimulationPdfGenerator";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { ResultadoSimulacao } from "./utils/simulationCalc";
import { COMPROMETIMENTO_MAX_RENDA } from "@/constants/bancos-financiamento";
import type { ItbiCalculation } from "@/lib/itbi/types";
import { describeBase } from "@/lib/itbi/calculate";
import { ItbiBadge } from "./results/ItbiBadge";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

interface Props {
  resultado: ResultadoSimulacao;
  itbiRate: number;
  itbiValue: number;
  state: string;
  itbiCalc?: ItbiCalculation | null;
  cityName?: string | null;
}

export function SimulationResults({ resultado: r, itbiRate, itbiValue, state, itbiCalc, cityName }: Props) {
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
    r.evolucao.slice(0, 12).forEach(p => rows.push(p));
    for (let i = 59; i < r.evolucao.length - 1; i += 60) {
      if (i >= 12) rows.push(r.evolucao[i]);
    }
    const last = r.evolucao[r.evolucao.length - 1];
    if (last && last.mes > 12) rows.push(last);
    return rows;
  }, [r.evolucao, showAllRows]);

  const comprPct = Math.min(r.comprometimentoRenda * 100, 100);

  const escritura = r.valorImovel * 0.0075;
  const registro = r.valorImovel * 0.004;
  const avaliacao = 2500;
  const totalCustosExtras = itbiValue + escritura + registro + avaliacao;

  const metricCards = [
    { label: "1ª Parcela", value: fmtBRL(r.primeiraParcela.parcela), icon: TrendingDown, accent: true },
    { label: "Última Parcela", value: fmtBRL(r.ultimaParcela.parcela), icon: TrendingUp },
    { label: "Total Pago", value: fmtBRL(r.totalPago), icon: DollarSign },
    { label: "Total Juros", value: fmtBRL(r.totalJuros), icon: Percent },
    { label: "Total Seguros", value: fmtBRL(r.totalSeguros), icon: ShieldCheck },
    { label: "CET Estimado", value: `${r.cetAnualEstimado.toFixed(2)}% a.a.`, icon: FileText },
  ];

  return (
    <Card className="overflow-hidden">
      {/* Header with bank color accent */}
      <div className="h-1.5 w-full" style={{ backgroundColor: r.cor }} />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: r.cor }}
            >
              {r.banco.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-base">{r.banco}</CardTitle>
              <p className="text-xs text-muted-foreground">Sistema {r.sistema} • {r.prazoMeses} meses</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={() => gerarPdfSimulacao(r)}>
            <Download className="h-3.5 w-3.5" /> Exportar PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="resumo">
          <div className="relative">
            <TabsList className="w-full grid grid-cols-4 h-9 overflow-x-auto">
              <TabsTrigger value="resumo" className="text-xs gap-1 shrink-0"><BarChart3 className="h-3 w-3 hidden sm:inline" /> Resumo</TabsTrigger>
              <TabsTrigger value="evolucao" className="text-xs gap-1 shrink-0"><TrendingDown className="h-3 w-3 hidden sm:inline" /> Evolução</TabsTrigger>
              <TabsTrigger value="renda" className="text-xs gap-1 shrink-0"><Wallet className="h-3 w-3 hidden sm:inline" /> Renda</TabsTrigger>
              <TabsTrigger value="custos" className="text-xs gap-1 shrink-0"><Receipt className="h-3 w-3 hidden sm:inline" /> Custos</TabsTrigger>
            </TabsList>
          </div>

          {/* ── Resumo ── */}
          <TabsContent value="resumo" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {metricCards.map(({ label, value, icon: Icon, accent }) => (
                <div key={label} className={`rounded-xl border p-3 ${accent ? 'bg-primary/5 border-primary/20' : 'bg-muted/30'}`}>
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1.5">
                    <Icon className="h-3 w-3" />{label}
                  </div>
                  <p className={`font-bold text-sm ${accent ? 'text-primary' : ''}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 border-border/50">
                <p className="text-xs font-semibold mb-3">Composição da 1ª Parcela</p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3} strokeWidth={0}>
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {pieData.map((d, i) => (
                    <Badge key={d.name} variant="outline" className="text-[10px] gap-1 font-normal">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }} />
                      {d.name}: {fmtBRL(d.value)}
                    </Badge>
                  ))}
                </div>
              </Card>

              <Card className="p-4 border-border/50">
                <p className="text-xs font-semibold mb-4">Composição do Custo Total</p>
                <div className="space-y-4">
                  {[
                    { label: "Principal", value: r.valorFinanciado, color: COLORS[0] },
                    { label: "Juros", value: r.totalJuros, color: COLORS[1] },
                    { label: "Seguros", value: r.totalSeguros, color: COLORS[2] },
                    { label: "Taxas Admin", value: r.totalTaxaAdmin, color: COLORS[4] },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-semibold">{fmtBRL(value)}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max((value / r.totalPago) * 100, 1)}%`,
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
            <div className="relative">
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left py-2.5 px-2 font-medium text-muted-foreground">Mês</th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">Parcela</th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">Amort.</th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">Juros</th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">MIP</th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">DFI</th>
                    <th className="text-right py-2.5 px-2 font-medium text-muted-foreground">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((p, idx) => (
                    <tr key={p.mes} className={`border-b border-border/30 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}>
                      <td className="py-2 px-2 font-semibold">{p.mes}</td>
                      <td className="text-right py-2 px-2 font-medium">{fmtBRL(p.parcela)}</td>
                      <td className="text-right py-2 px-2">{fmtBRL(p.amortizacao)}</td>
                      <td className="text-right py-2 px-2">{fmtBRL(p.juros)}</td>
                      <td className="text-right py-2 px-2">{fmtBRL(p.seguroMIP)}</td>
                      <td className="text-right py-2 px-2">{fmtBRL(p.seguroDFI)}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">{fmtBRL(p.saldoDevedor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden rounded-r-lg" />
            </div>
            <Button
              variant="ghost" size="sm" className="w-full mt-2 gap-1.5 text-xs"
              onClick={() => setShowAllRows(!showAllRows)}
            >
              {showAllRows ? <><ChevronUp className="h-3.5 w-3.5" /> Mostrar resumo</> : <><ChevronDown className="h-3.5 w-3.5" /> Ver todos os {r.evolucao.length} meses</>}
            </Button>
          </TabsContent>

          {/* ── Renda ── */}
          <TabsContent value="renda" className="mt-4 space-y-4">
            <Card className="p-5 space-y-4 border-border/50">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Análise de Renda</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Comprometimento</span>
                  <span className={`font-bold ${comprPct > 30 ? 'text-destructive' : 'text-green-500'}`}>
                    {comprPct.toFixed(1)}%
                  </span>
                </div>
                <div className="relative">
                  <Progress value={comprPct} className="h-5 rounded-full" />
                  <div
                    className="absolute top-0 h-5 w-0.5 bg-destructive"
                    style={{ left: `${COMPROMETIMENTO_MAX_RENDA * 100}%` }}
                    title="Limite 30%"
                  />
                  <span className="absolute text-[9px] text-destructive font-medium" style={{ left: `${COMPROMETIMENTO_MAX_RENDA * 100 - 2}%`, top: '22px' }}>
                    30%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 min-[380px]:grid-cols-3 gap-3 text-xs mt-4">
                {[
                  { label: "Renda bruta", value: fmtBRL(r.primeiraParcela.parcela / r.comprometimentoRenda || 0) },
                  { label: "Renda mínima", value: fmtBRL(r.rendaMinimaExigida) },
                  { label: "1ª Parcela", value: fmtBRL(r.primeiraParcela.parcela) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/30 rounded-lg p-2.5">
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                    <p className="font-bold mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              {!r.aprovado && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 mt-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="text-xs space-y-1.5">
                      <p className="font-semibold text-destructive">Renda insuficiente</p>
                      <p>Renda mínima: <strong>{fmtBRL(r.rendaMinimaExigida)}</strong></p>
                      <p className="text-muted-foreground">Sugestões: aumentar entrada, reduzir prazo ou compor renda.</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* ── Custos Extras ── */}
          <TabsContent value="custos" className="mt-4">
            <Card className="p-5 border-border/50">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">
                    Custos de Aquisição ({cityName ? `${cityName} - ${state}` : state})
                  </p>
                </div>
                {itbiCalc && (
                  <ItbiBadge
                    confidence={itbiCalc.confidence}
                    sourceLabel={itbiCalc.sourceLabel}
                    sourceUrl={itbiCalc.sourceUrl}
                  />
                )}
              </div>
              <div className="space-y-3">
                {[
                  {
                    label: `ITBI (${itbiRate.toFixed(2)}%)`,
                    value: itbiValue,
                    sub: itbiCalc ? describeBase(itbiCalc.rule) : undefined,
                  },
                  { label: "Escritura (~0,75%)", value: escritura },
                  { label: "Registro (~0,4%)", value: registro },
                  { label: "Avaliação do imóvel", value: avaliacao },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="flex justify-between items-start text-sm">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">{label}</span>
                      {sub && <span className="text-[10px] text-muted-foreground/70">{sub}</span>}
                    </div>
                    <span className="font-medium">{fmtBRL(value)}</span>
                  </div>
                ))}
                {itbiCalc && itbiCalc.breakdown.length > 1 && (
                  <div className="rounded-md bg-muted/40 p-3 space-y-1">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
                      Detalhamento ITBI
                    </p>
                    {itbiCalc.breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">{b.label}</span>
                        <span className="font-medium">{fmtBRL(b.value)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="font-semibold text-sm">Total estimado</span>
                  <span className="font-bold text-primary text-base">{fmtBRL(totalCustosExtras)}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-4">
                * Valores estimados. Consulte o cartório e prefeitura para valores exatos.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
