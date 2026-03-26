import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calculator, Wifi, WifiOff, ShieldCheck, ShieldAlert,
  AlertTriangle, CheckCircle2, Building2, User, Banknote,
} from "lucide-react";
import { useTaxaReferencial } from "@/hooks/useTaxaReferencial";
import { useSelicRate } from "@/hooks/financing/useSelicRate";
import { simularTodosBancos, type ResultadoSimulacao } from "./utils/simulationCalc";
import { BankComparisonView } from "./BankComparisonView";
import { SimulationResults } from "./SimulationResults";
import {
  TETO_SFH, IDADE_MAX_FIM_CONTRATO, COMPROMETIMENTO_MAX_RENDA,
  ITBI_RATES,
} from "@/constants/bancos-financiamento";
import { CurrencyInput } from "@/components/ui/currency-input";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FinancingSimulator() {
  const [valorImovel, setValorImovel] = useState(500_000);
  const [percEntrada, setPercEntrada] = useState(20);
  const [prazoAnos, setPrazoAnos] = useState(30);
  const [sistema, setSistema] = useState<"SAC" | "PRICE">("SAC");
  const [rendaMensal, setRendaMensal] = useState<number | null>(null);
  const [idade, setIdade] = useState(30);
  const [usarFgts, setUsarFgts] = useState(false);
  const [valorFgts, setValorFgts] = useState<number | null>(null);
  const [state, setState] = useState("SP");
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);

  const { data: trMensal, isLoading: trLoading, isError: trError } = useTaxaReferencial();
  const { data: selicRate } = useSelicRate();

  const prazoMaxIdade = Math.floor((IDADE_MAX_FIM_CONTRATO - idade) * 12);
  const prazoMaxAnos = Math.min(35, Math.floor(prazoMaxIdade / 12));
  const prazoMeses = Math.min(prazoAnos * 12, prazoMaxIdade);

  const valorEntrada = valorImovel * (percEntrada / 100);
  const valorFinanciado = Math.max(valorImovel - valorEntrada - (usarFgts ? (valorFgts ?? 0) : 0), 0);
  const isSFH = valorImovel <= TETO_SFH;

  const resultados = useMemo(() => {
    if (valorFinanciado <= 0 || prazoMeses <= 0) return [];
    return simularTodosBancos({
      valorImovel,
      valorEntrada,
      valorFgts: usarFgts ? (valorFgts ?? 0) : 0,
      prazoMeses,
      idadeComprador: idade,
      rendaMensal: rendaMensal ?? 0,
      sistema,
      trMensal: trMensal ?? 0.169,
    });
  }, [valorImovel, valorEntrada, valorFgts, usarFgts, prazoMeses, idade, rendaMensal, sistema, trMensal]);

  const selectedResult = useMemo(() => {
    if (!selectedBankId) return resultados[0] ?? null;
    return resultados.find(r => r.bancoId === selectedBankId) ?? resultados[0] ?? null;
  }, [resultados, selectedBankId]);

  const handleSelectBank = useCallback((id: string) => setSelectedBankId(id), []);

  const itbiRate = ITBI_RATES[state] ?? 3;
  const itbiValue = valorImovel * (itbiRate / 100);

  return (
    <div className="space-y-6">
      {/* ── Header with live rates ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Simulador de Financiamento</h2>
            <p className="text-xs text-muted-foreground">Compare bancos em tempo real com dados do Banco Central</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {trLoading ? (
            <Skeleton className="h-5 w-48" />
          ) : trError ? (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <WifiOff className="h-3 w-3" /> TR indisponível — fallback 0,1690%
            </Badge>
          ) : (
            <>
              <Badge variant="outline" className="gap-1 text-[10px] border-green-500/30 text-green-500">
                <Wifi className="h-3 w-3" /> TR: {trMensal?.toFixed(4)}%
              </Badge>
              {selicRate && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  Selic: {selicRate.toFixed(2)}% a.a.
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">BCB ao vivo</Badge>
            </>
          )}
        </div>
      </div>

      {/* ── Input Form ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Section 1: Imóvel */}
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
              <Slider
                min={100_000} max={5_000_000} step={10_000}
                value={[valorImovel]}
                onValueChange={([v]) => setValorImovel(v)}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>R$ 100 mil</span><span>R$ 5 mi</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <Label className="text-xs">Entrada</Label>
                <span className="text-sm font-bold">{percEntrada}% <span className="text-muted-foreground font-normal text-xs">({fmtBRL(valorEntrada)})</span></span>
              </div>
              <Slider
                min={10} max={80} step={1}
                value={[percEntrada]}
                onValueChange={([v]) => setPercEntrada(v)}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>10%</span><span>80%</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={usarFgts} onCheckedChange={setUsarFgts} />
                  <Label className="text-xs">Usar FGTS</Label>
                </div>
              </div>
              {usarFgts && (
                <CurrencyInput
                  value={valorFgts}
                  onChange={setValorFgts}
                  placeholder="R$ 50.000,00"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Estado (ITBI)</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(ITBI_RATES).sort().map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf} ({ITBI_RATES[uf]}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Financiamento */}
        <Card className="border-border/50">
          <CardContent className="pt-5 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financiamento</span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <Label className="text-xs">Prazo</Label>
                <span className="text-sm font-bold">{prazoAnos} anos <span className="text-muted-foreground font-normal text-xs">({prazoMeses} meses)</span></span>
              </div>
              <Slider
                min={5} max={prazoMaxAnos} step={1}
                value={[Math.min(prazoAnos, prazoMaxAnos)]}
                onValueChange={([v]) => setPrazoAnos(v)}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5 anos</span><span>{prazoMaxAnos} anos (máx.)</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Sistema de Amortização</Label>
              <Tabs value={sistema} onValueChange={(v) => setSistema(v as "SAC" | "PRICE")}>
                <TabsList className="w-full h-9">
                  <TabsTrigger value="SAC" className="flex-1 text-xs h-7">SAC</TabsTrigger>
                  <TabsTrigger value="PRICE" className="flex-1 text-xs h-7">PRICE</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {sistema === "SAC"
                  ? "Parcelas decrescentes — paga menos juros no total"
                  : "Parcelas fixas — mais previsibilidade no orçamento"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Comprador */}
        <Card className="border-border/50">
          <CardContent className="pt-5 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comprador</span>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Renda Mensal Bruta</Label>
              <CurrencyInput
                value={rendaMensal}
                onChange={setRendaMensal}
                placeholder="R$ 8.000,00"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Idade</Label>
              <Input
                type="number" min={18} max={75}
                value={idade}
                className="h-9"
                onChange={(e) => setIdade(Math.max(18, Math.min(75, parseInt(e.target.value) || 18)))}
              />
              <p className="text-[10px] text-muted-foreground">Prazo máx. por idade: {Math.floor(prazoMaxIdade / 12)} anos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Status Badges ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={isSFH ? "default" : "destructive"} className="gap-1 text-xs">
          {isSFH ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
          {isSFH ? "SFH" : "SFI (acima do teto)"}
        </Badge>
        <Badge variant="secondary" className="text-xs font-semibold">
          Financiado: {fmtBRL(valorFinanciado)}
        </Badge>
        {rendaMensal && rendaMensal > 0 && resultados[0] && (
          <Badge variant={resultados[0].aprovado ? "default" : "destructive"} className="gap-1 text-xs">
            {resultados[0].aprovado
              ? <><CheckCircle2 className="h-3.5 w-3.5" /> Renda compatível</>
              : <><AlertTriangle className="h-3.5 w-3.5" /> Renda insuficiente</>
            }
          </Badge>
        )}
      </div>

      {/* ── Bank Comparison ── */}
      {resultados.length > 0 && (
        <BankComparisonView
          resultados={resultados}
          selectedBankId={selectedBankId}
          onSelectBank={handleSelectBank}
        />
      )}

      {/* ── Detailed Results ── */}
      {selectedResult && (
        <SimulationResults
          resultado={selectedResult}
          itbiRate={itbiRate}
          itbiValue={itbiValue}
          state={state}
        />
      )}
    </div>
  );
}
