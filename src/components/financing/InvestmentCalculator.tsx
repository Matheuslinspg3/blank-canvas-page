import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, PiggyBank, Building2, BarChart3, 
  DollarSign, Calendar, Percent, ArrowUpRight,
} from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useSelicRate } from "@/hooks/financing/useSelicRate";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from "recharts";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtPct = (v: number) => `${v.toFixed(2)}%`;

type TipoImovel = "aluguel" | "venda";

interface CalcResult {
  yieldAnual: number;
  yieldMensal: number;
  paybackAnos: number;
  rendaAnual: number;
  rendaMensal: number;
  valorizacaoAnual: number;
  retornoTotal5Anos: number;
  retornoTotal10Anos: number;
  comparativoCDB: number;
  comparativoSelic: number;
  comparativoPoupanca: number;
  evolucao: { ano: number; imovel: number; cdb: number; selic: number; poupanca: number }[];
}

function calcularRentabilidade(params: {
  valorImovel: number;
  rendaMensal: number;
  valorizacaoAnualPct: number;
  condominioMensal: number;
  iptuAnual: number;
  manutencaoPct: number;
  vacanciaAnualMeses: number;
  selicRate: number;
}): CalcResult {
  const { valorImovel, rendaMensal, valorizacaoAnualPct, condominioMensal, iptuAnual, manutencaoPct, vacanciaAnualMeses, selicRate } = params;

  const rendaBruta = rendaMensal * 12;
  const custoOperacional = (condominioMensal * 12) + iptuAnual + (valorImovel * manutencaoPct / 100);
  const perda = rendaMensal * vacanciaAnualMeses;
  const rendaLiquida = rendaBruta - custoOperacional - perda;
  
  const yieldAnual = valorImovel > 0 ? (rendaLiquida / valorImovel) * 100 : 0;
  const yieldMensal = yieldAnual / 12;
  const paybackAnos = rendaLiquida > 0 ? valorImovel / rendaLiquida : Infinity;

  const valorizacaoAnual = valorImovel * (valorizacaoAnualPct / 100);

  const cdbRate = selicRate * 0.9; // CDB ~90% CDI
  const poupancaRate = selicRate > 8.5 ? 6.17 + 0.5 : selicRate * 0.7;

  const evolucao: CalcResult["evolucao"] = [];
  let acumImovel = valorImovel;
  let acumCDB = valorImovel;
  let acumSelic = valorImovel;
  let acumPoupanca = valorImovel;

  for (let ano = 0; ano <= 10; ano++) {
    evolucao.push({
      ano,
      imovel: acumImovel + (rendaLiquida * ano),
      cdb: acumCDB,
      selic: acumSelic,
      poupanca: acumPoupanca,
    });
    acumImovel *= (1 + valorizacaoAnualPct / 100);
    acumCDB *= (1 + cdbRate / 100);
    acumSelic *= (1 + selicRate / 100);
    acumPoupanca *= (1 + poupancaRate / 100);
  }

  return {
    yieldAnual,
    yieldMensal,
    paybackAnos,
    rendaAnual: rendaLiquida,
    rendaMensal: rendaLiquida / 12,
    valorizacaoAnual,
    retornoTotal5Anos: evolucao[5]?.imovel ?? 0,
    retornoTotal10Anos: evolucao[10]?.imovel ?? 0,
    comparativoCDB: cdbRate,
    comparativoSelic: selicRate,
    comparativoPoupanca: poupancaRate,
    evolucao,
  };
}

export function InvestmentCalculator() {
  const [valorImovel, setValorImovel] = useState(500_000);
  const [aluguelMensal, setAluguelMensal] = useState<number | null>(2500);
  const [valorizacao, setValorizacao] = useState(5);
  const [condominio, setCondominio] = useState<number | null>(500);
  const [iptu, setIptu] = useState<number | null>(3000);
  const [manutencao, setManutencao] = useState(1);
  const [vacancia, setVacancia] = useState(1);

  const { data: selicRate } = useSelicRate();
  const selic = selicRate ?? 14.25;

  const resultado = useMemo(() => calcularRentabilidade({
    valorImovel,
    rendaMensal: aluguelMensal ?? 0,
    valorizacaoAnualPct: valorizacao,
    condominioMensal: condominio ?? 0,
    iptuAnual: iptu ?? 0,
    manutencaoPct: manutencao,
    vacanciaAnualMeses: vacancia,
    selicRate: selic,
  }), [valorImovel, aluguelMensal, valorizacao, condominio, iptu, manutencao, vacancia, selic]);

  const yieldColor = resultado.yieldAnual >= selic ? "text-green-500" : resultado.yieldAnual >= 5 ? "text-yellow-500" : "text-destructive";

  const comparativoData = [
    { name: "Imóvel", value: resultado.yieldAnual + valorizacao, fill: "hsl(var(--primary))" },
    { name: "CDB", value: resultado.comparativoCDB, fill: "hsl(var(--chart-2))" },
    { name: "Selic", value: resultado.comparativoSelic, fill: "hsl(var(--chart-3))" },
    { name: "Poupança", value: resultado.comparativoPoupanca, fill: "hsl(var(--chart-4))" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <PiggyBank className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Calculadora de Rentabilidade</h2>
          <p className="text-xs text-muted-foreground">Analise o retorno do investimento imobiliário vs renda fixa</p>
        </div>
      </div>

      {/* Input Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-5 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imóvel</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <Label className="text-xs">Valor do Imóvel</Label>
                <span className="text-sm font-bold text-primary">{fmtBRL(valorImovel)}</span>
              </div>
              <Slider min={100_000} max={5_000_000} step={10_000} value={[valorImovel]} onValueChange={([v]) => setValorImovel(v)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Aluguel Mensal Estimado</Label>
              <CurrencyInput value={aluguelMensal} onChange={setAluguelMensal} placeholder="R$ 2.500" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <Label className="text-xs">Valorização anual estimada</Label>
                <span className="text-sm font-bold">{valorizacao}%</span>
              </div>
              <Slider min={0} max={15} step={0.5} value={[valorizacao]} onValueChange={([v]) => setValorizacao(v)} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="pt-5 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custos</span>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Condomínio mensal</Label>
              <CurrencyInput value={condominio} onChange={setCondominio} placeholder="R$ 500" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">IPTU anual</Label>
              <CurrencyInput value={iptu} onChange={setIptu} placeholder="R$ 3.000" />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <Label className="text-xs">Manutenção (% a.a.)</Label>
                <span className="text-sm font-bold">{manutencao}%</span>
              </div>
              <Slider min={0} max={5} step={0.5} value={[manutencao]} onValueChange={([v]) => setManutencao(v)} />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <Label className="text-xs">Vacância (meses/ano)</Label>
                <span className="text-sm font-bold">{vacancia} {vacancia === 1 ? "mês" : "meses"}</span>
              </div>
              <Slider min={0} max={6} step={1} value={[vacancia]} onValueChange={([v]) => setVacancia(v)} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {[
          { label: "Yield Anual", value: fmtPct(resultado.yieldAnual), icon: Percent, className: yieldColor },
          { label: "Yield Mensal", value: fmtPct(resultado.yieldMensal), icon: TrendingUp },
          { label: "Renda Líquida/mês", value: fmtBRL(resultado.rendaMensal), icon: DollarSign },
          { label: "Payback", value: resultado.paybackAnos === Infinity ? "—" : `${resultado.paybackAnos.toFixed(1)} anos`, icon: Calendar },
          { label: "Retorno 5 anos", value: fmtBRL(resultado.retornoTotal5Anos), icon: ArrowUpRight },
          { label: "Retorno 10 anos", value: fmtBRL(resultado.retornoTotal10Anos), icon: BarChart3 },
        ].map(({ label, value, icon: Icon, className }) => (
          <div key={label} className="rounded-xl border bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1.5">
              <Icon className="h-3 w-3" />{label}
            </div>
            <p className={`font-bold text-sm ${className ?? ""}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Evolução Patrimonial */}
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold mb-4">Evolução Patrimonial — 10 Anos</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={resultado.evolucao}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="ano" tick={{ fontSize: 10 }} label={{ value: "Ano", position: "bottom", fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => fmtBRL(v)} labelFormatter={(l) => `Ano ${l}`} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="imovel" name="Imóvel + Aluguel" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="cdb" name="CDB 90% CDI" stroke="hsl(var(--chart-2))" fill="hsl(var(--chart-2))" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="selic" name="Selic" stroke="hsl(var(--chart-3))" fill="hsl(var(--chart-3))" fillOpacity={0.08} strokeWidth={1.5} strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="poupanca" name="Poupança" stroke="hsl(var(--chart-4))" fill="hsl(var(--chart-4))" fillOpacity={0.05} strokeWidth={1} strokeDasharray="3 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Comparativo de Rentabilidade */}
        <Card className="border-border/50">
          <CardContent className="pt-5">
            <p className="text-xs font-semibold mb-4">Rentabilidade Anual Comparada</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                    {comparativoData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <p>
                <strong className="text-foreground">Análise:</strong>{" "}
                {resultado.yieldAnual + valorizacao > selic
                  ? "O investimento imobiliário supera a Selic atual, considerando yield + valorização."
                  : "A renda fixa está mais atrativa no momento. Considere negociar o preço ou buscar imóveis com maior yield."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selic Badge */}
      <div className="flex items-center gap-2 text-xs">
        <Badge variant="outline" className="text-[10px]">
          Selic: {selic.toFixed(2)}% a.a. (ao vivo BCB)
        </Badge>
        <span className="text-muted-foreground">Valores estimados — não constituem recomendação de investimento.</span>
      </div>
    </div>
  );
}
