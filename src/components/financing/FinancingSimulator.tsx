import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertTriangle, CheckCircle2,
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

  // ITBI
  const itbiRate = ITBI_RATES[state] ?? 3;
  const itbiValue = valorImovel * (itbiRate / 100);

  return (
    <div className="space-y-6">
      {/* TR / Selic indicator */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {trLoading ? (
          <Skeleton className="h-4 w-48" />
        ) : trError ? (
          <>
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
            <span>TR indisponível — usando fallback 0,1690%</span>
          </>
        ) : (
          <>
            <Wifi className="h-3.5 w-3.5 text-green-500" />
            <span>TR mensal: <strong>{trMensal?.toFixed(4)}%</strong></span>
            {selicRate && <span>| Selic: <strong>{selicRate.toFixed(2)}% a.a.</strong></span>}
            <Badge variant="outline" className="text-[10px]">BCB em tempo real</Badge>
          </>
        )}
      </div>

      {/* ── Input Form ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Simulador de Financiamento Imobiliário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Valor do Imóvel: {fmtBRL(valorImovel)}</Label>
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
              <Label>Entrada: {percEntrada}% ({fmtBRL(valorEntrada)})</Label>
              <Slider
                min={10} max={80} step={1}
                value={[percEntrada]}
                onValueChange={([v]) => setPercEntrada(v)}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>10%</span><span>80%</span>
              </div>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label>Prazo: {prazoAnos} anos ({prazoMeses} meses)</Label>
              <Slider
                min={5} max={prazoMaxAnos} step={1}
                value={[Math.min(prazoAnos, prazoMaxAnos)]}
                onValueChange={([v]) => setPrazoAnos(v)}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>5 anos</span><span>{prazoMaxAnos} anos (máx. idade)</span>
              </div>
            </div>
            <div className="space-y-3">
              <Label>Renda Mensal Bruta</Label>
              <CurrencyInput
                value={rendaMensal}
                onChange={setRendaMensal}
                placeholder="R$ 8.000,00"
              />
            </div>
            <div className="space-y-3">
              <Label>Idade do Comprador</Label>
              <Input
                type="number" min={18} max={75}
                value={idade}
                onChange={(e) => setIdade(Math.max(18, Math.min(75, parseInt(e.target.value) || 18)))}
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <Label>Sistema de Amortização</Label>
              <Tabs value={sistema} onValueChange={(v) => setSistema(v as "SAC" | "PRICE")}>
                <TabsList className="w-full">
                  <TabsTrigger value="SAC" className="flex-1">SAC</TabsTrigger>
                  <TabsTrigger value="PRICE" className="flex-1">PRICE</TabsTrigger>
                </TabsList>
              </Tabs>
              <p className="text-[10px] text-muted-foreground">
                {sistema === "SAC"
                  ? "Parcelas decrescentes — amortização constante"
                  : "Parcelas fixas — amortização crescente"}
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={usarFgts} onCheckedChange={setUsarFgts} />
                <Label>Usar FGTS na entrada</Label>
              </div>
              {usarFgts && (
                <CurrencyInput
                  value={valorFgts}
                  onChange={setValorFgts}
                  placeholder="R$ 50.000,00"
                />
              )}
            </div>
            <div className="space-y-3">
              <Label>Estado (para ITBI)</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(ITBI_RATES).sort().map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf} ({ITBI_RATES[uf]}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Badges */}
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Badge variant={isSFH ? "default" : "destructive"} className="gap-1">
              {isSFH ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
              {isSFH ? "SFH" : "SFI (acima do teto)"}
            </Badge>
            <Badge variant="outline">Financiado: {fmtBRL(valorFinanciado)}</Badge>
            <Badge variant="outline">Prazo máx. idade: {Math.floor(prazoMaxIdade / 12)} anos</Badge>
            {rendaMensal && rendaMensal > 0 && resultados[0] && (
              <Badge variant={resultados[0].aprovado ? "default" : "destructive"} className="gap-1">
                {resultados[0].aprovado
                  ? <><CheckCircle2 className="h-3 w-3" /> Renda compatível</>
                  : <><AlertTriangle className="h-3 w-3" /> Renda insuficiente</>
                }
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

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
