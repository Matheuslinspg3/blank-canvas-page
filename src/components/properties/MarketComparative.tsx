import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  BarChart3, Plus, Trash2, Download, TrendingUp,
  MapPin, Ruler, BedDouble, DollarSign,
} from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
import jsPDF from "jspdf";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ComparativeProperty {
  id: string;
  endereco: string;
  bairro: string;
  area: number;
  quartos: number;
  valor: number;
  tipo: "avaliando" | "comparativo";
}

const EMPTY_PROPERTY: Omit<ComparativeProperty, "id"> = {
  endereco: "",
  bairro: "",
  area: 0,
  quartos: 0,
  valor: 0,
  tipo: "comparativo",
};

export function MarketComparative() {
  const [properties, setProperties] = useState<ComparativeProperty[]>([
    { id: "target", endereco: "", bairro: "", area: 0, quartos: 0, valor: 0, tipo: "avaliando" },
  ]);

  const addProperty = () => {
    if (properties.length >= 7) {
      toast.error("Máximo de 6 comparativos + 1 imóvel avaliando.");
      return;
    }
    setProperties([...properties, { ...EMPTY_PROPERTY, id: crypto.randomUUID() }]);
  };

  const removeProperty = (id: string) => {
    setProperties(properties.filter((p) => p.id !== id));
  };

  const updateProperty = (id: string, field: keyof ComparativeProperty, value: any) => {
    setProperties(properties.map((p) => p.id === id ? { ...p, [field]: value } : p));
  };

  const comparativos = properties.filter((p) => p.tipo === "comparativo" && p.area > 0 && p.valor > 0);
  const avaliando = properties.find((p) => p.tipo === "avaliando");

  const analysis = useMemo(() => {
    if (comparativos.length === 0) return null;

    const precosPorM2 = comparativos.map((p) => ({
      ...p,
      precoM2: p.valor / p.area,
    }));

    const mediaM2 = precosPorM2.reduce((s, p) => s + p.precoM2, 0) / precosPorM2.length;
    const minM2 = Math.min(...precosPorM2.map((p) => p.precoM2));
    const maxM2 = Math.max(...precosPorM2.map((p) => p.precoM2));
    const medianaM2 = [...precosPorM2].sort((a, b) => a.precoM2 - b.precoM2)[Math.floor(precosPorM2.length / 2)]?.precoM2 ?? 0;

    const valorSugerido = avaliando && avaliando.area > 0 ? medianaM2 * avaliando.area : 0;

    return {
      precosPorM2,
      mediaM2,
      minM2,
      maxM2,
      medianaM2,
      valorSugerido,
    };
  }, [comparativos, avaliando]);

  const chartData = useMemo(() => {
    if (!analysis) return [];
    return analysis.precosPorM2.map((p, i) => ({
      name: p.bairro || `Imóvel ${i + 1}`,
      precoM2: Math.round(p.precoM2),
      fill: `hsl(var(--chart-${(i % 5) + 1}))`,
    }));
  }, [analysis]);

  const generatePDF = () => {
    if (!analysis || !avaliando) return;

    const doc = new jsPDF();
    const margin = 20;
    let y = margin;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Análise Comparativa de Mercado (CMA)", margin, y);
    y += 12;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, margin, y);
    y += 15;

    // Imóvel avaliando
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Imóvel em Avaliação", margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Endereço: ${avaliando.endereco || "—"}`, margin, y); y += 6;
    doc.text(`Bairro: ${avaliando.bairro || "—"}`, margin, y); y += 6;
    doc.text(`Área: ${avaliando.area} m²`, margin, y); y += 6;
    doc.text(`Quartos: ${avaliando.quartos}`, margin, y); y += 12;

    // Comparativos
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Imóveis Comparativos", margin, y);
    y += 10;

    doc.setFontSize(9);
    // Table header
    const cols = [margin, 65, 95, 120, 160];
    doc.setFont("helvetica", "bold");
    doc.text("Endereço", cols[0], y);
    doc.text("Bairro", cols[1], y);
    doc.text("Área", cols[2], y);
    doc.text("Valor", cols[3], y);
    doc.text("R$/m²", cols[4], y);
    y += 6;

    doc.setFont("helvetica", "normal");
    comparativos.forEach((p) => {
      const pm2 = p.valor / p.area;
      doc.text(p.endereco.substring(0, 25) || "—", cols[0], y);
      doc.text(p.bairro.substring(0, 15) || "—", cols[1], y);
      doc.text(`${p.area} m²`, cols[2], y);
      doc.text(fmtBRL(p.valor), cols[3], y);
      doc.text(fmtBRL(pm2), cols[4], y);
      y += 6;
    });
    y += 8;

    // Resultado
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Resultado da Análise", margin, y);
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Média R$/m²: ${fmtBRL(analysis.mediaM2)}`, margin, y); y += 6;
    doc.text(`Mediana R$/m²: ${fmtBRL(analysis.medianaM2)}`, margin, y); y += 6;
    doc.text(`Faixa: ${fmtBRL(analysis.minM2)} — ${fmtBRL(analysis.maxM2)}`, margin, y); y += 10;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Valor Sugerido: ${fmtBRL(analysis.valorSugerido)}`, margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`(Mediana R$/m² × ${avaliando.area} m²)`, margin, y);

    doc.save("CMA_analise_comparativa.pdf");
    toast.success("PDF gerado com sucesso!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Análise Comparativa de Mercado</h2>
            <p className="text-xs text-muted-foreground">Compare imóveis similares para justificar o preço</p>
          </div>
        </div>
        {analysis && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={generatePDF}>
            <Download className="h-3.5 w-3.5" /> Exportar PDF
          </Button>
        )}
      </div>

      {/* Imóvel Avaliando */}
      {avaliando && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="text-[10px]">Imóvel em Avaliação</Badge>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Endereço</Label>
                <Input className="h-9 text-xs" placeholder="Rua..." value={avaliando.endereco} onChange={(e) => updateProperty(avaliando.id, "endereco", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bairro</Label>
                <Input className="h-9 text-xs" placeholder="Bairro" value={avaliando.bairro} onChange={(e) => updateProperty(avaliando.id, "bairro", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Área (m²)</Label>
                <Input className="h-9 text-xs" type="number" value={avaliando.area || ""} onChange={(e) => updateProperty(avaliando.id, "area", Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Quartos</Label>
                <Input className="h-9 text-xs" type="number" value={avaliando.quartos || ""} onChange={(e) => updateProperty(avaliando.id, "quartos", Number(e.target.value))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparativos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Imóveis Comparativos</p>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={addProperty}>
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>

        {properties.filter((p) => p.tipo === "comparativo").map((prop, i) => (
          <Card key={prop.id} className="border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between mb-3">
                <Badge variant="outline" className="text-[10px]">Comparativo {i + 1}</Badge>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => removeProperty(prop.id)}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Endereço</Label>
                  <Input className="h-9 text-xs" placeholder="Rua..." value={prop.endereco} onChange={(e) => updateProperty(prop.id, "endereco", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bairro</Label>
                  <Input className="h-9 text-xs" placeholder="Bairro" value={prop.bairro} onChange={(e) => updateProperty(prop.id, "bairro", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Área (m²)</Label>
                  <Input className="h-9 text-xs" type="number" value={prop.area || ""} onChange={(e) => updateProperty(prop.id, "area", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Quartos</Label>
                  <Input className="h-9 text-xs" type="number" value={prop.quartos || ""} onChange={(e) => updateProperty(prop.id, "quartos", Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Valor</Label>
                  <CurrencyInput value={prop.valor || null} onChange={(v) => updateProperty(prop.id, "valor", v ?? 0)} placeholder="R$ 0" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Results */}
      {analysis && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Média R$/m²", value: fmtBRL(analysis.mediaM2), icon: DollarSign },
              { label: "Mediana R$/m²", value: fmtBRL(analysis.medianaM2), icon: TrendingUp },
              { label: "Mínimo R$/m²", value: fmtBRL(analysis.minM2), icon: Ruler },
              { label: "Máximo R$/m²", value: fmtBRL(analysis.maxM2), icon: MapPin },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1.5">
                  <Icon className="h-3 w-3" />{label}
                </div>
                <p className="font-bold text-sm">{value}</p>
              </div>
            ))}
          </div>

          {/* Valor sugerido */}
          {avaliando && avaliando.area > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-5 text-center">
                <p className="text-xs text-muted-foreground mb-1">Valor Sugerido para o Imóvel</p>
                <p className="text-3xl font-bold text-primary">{fmtBRL(analysis.valorSugerido)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Mediana {fmtBRL(analysis.medianaM2)}/m² × {avaliando.area} m²
                </p>
              </CardContent>
            </Card>
          )}

          {/* Chart */}
          <Card className="border-border/50">
            <CardContent className="pt-5">
              <p className="text-xs font-semibold mb-4">Preço por m² — Comparativo</p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => fmtBRL(v)} />
                    <Bar dataKey="precoM2" name="R$/m²" radius={[6, 6, 0, 0]} barSize={40}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
