import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LineChart, Line,
} from "recharts";
import type { ResultadoSimulacao } from "./utils/simulationCalc";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  resultados: ResultadoSimulacao[];
  selectedBankId: string | null;
}

export function EvolutionChart({ resultados, selectedBankId }: Props) {
  // Build chart data: parcela and saldo devedor per year for each bank
  const parcelaData = useMemo(() => {
    if (!resultados.length) return [];
    const maxMeses = Math.max(...resultados.map(r => r.evolucao.length));
    const points: Record<string, any>[] = [];

    // Sample every 12 months
    for (let m = 0; m < maxMeses; m += 12) {
      const point: Record<string, any> = { ano: Math.floor(m / 12) };
      resultados.forEach(r => {
        const row = r.evolucao[m];
        if (row) {
          point[`parcela_${r.bancoId}`] = Math.round(row.parcela);
          point[`saldo_${r.bancoId}`] = Math.round(row.saldoDevedor);
        }
      });
      points.push(point);
    }
    // Add last month
    const lastPoint: Record<string, any> = { ano: Math.floor(maxMeses / 12) };
    resultados.forEach(r => {
      const last = r.evolucao[r.evolucao.length - 1];
      if (last) {
        lastPoint[`parcela_${r.bancoId}`] = Math.round(last.parcela);
        lastPoint[`saldo_${r.bancoId}`] = Math.round(last.saldoDevedor);
      }
    });
    points.push(lastPoint);

    return points;
  }, [resultados]);

  const selected = selectedBankId ?? resultados[0]?.bancoId;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Evolução das Parcelas */}
      <Card className="border-border/50">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold mb-1">Evolução das Parcelas</p>
          <p className="text-[10px] text-muted-foreground mb-4">Comparação mensal entre bancos ao longo do tempo</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={parcelaData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="ano" tick={{ fontSize: 10 }} label={{ value: "Ano", position: "bottom", fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} labelFormatter={(l) => `Ano ${l}`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {resultados.map((r) => (
                  <Line
                    key={r.bancoId}
                    type="monotone"
                    dataKey={`parcela_${r.bancoId}`}
                    name={r.banco}
                    stroke={r.cor}
                    strokeWidth={r.bancoId === selected ? 2.5 : 1}
                    strokeOpacity={r.bancoId === selected ? 1 : 0.4}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Saldo Devedor */}
      <Card className="border-border/50">
        <CardContent className="pt-5">
          <p className="text-xs font-semibold mb-1">Saldo Devedor</p>
          <p className="text-[10px] text-muted-foreground mb-4">Como a dívida diminui ao longo do financiamento</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={parcelaData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="ano" tick={{ fontSize: 10 }} label={{ value: "Ano", position: "bottom", fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} labelFormatter={(l) => `Ano ${l}`} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {resultados.map((r) => (
                  <Area
                    key={r.bancoId}
                    type="monotone"
                    dataKey={`saldo_${r.bancoId}`}
                    name={r.banco}
                    stroke={r.cor}
                    fill={r.cor}
                    fillOpacity={r.bancoId === selected ? 0.12 : 0.03}
                    strokeWidth={r.bancoId === selected ? 2 : 1}
                    strokeOpacity={r.bancoId === selected ? 1 : 0.4}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
