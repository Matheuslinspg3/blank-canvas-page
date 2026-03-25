import jsPDF from "jspdf";
import type { ResultadoSimulacao } from "./utils/simulationCalc";

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function gerarPdfSimulacao(r: ResultadoSimulacao, extras?: {
  corretorNome?: string;
  corretorCreci?: string;
  corretorTelefone?: string;
  itbiValue?: number;
}) {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  let y = 20;

  const addLine = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(label, 14, y);
    doc.setFont("helvetica", "bold");
    doc.text(value, w - 14, y, { align: "right" });
    y += 6;
  };

  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Simulação de Financiamento Imobiliário", 14, y);
  y += 10;

  // Bank
  doc.setFontSize(12);
  doc.text(`${r.banco} — Sistema ${r.sistema}`, 14, y);
  y += 10;

  // Dados do imóvel
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Dados do Financiamento", 14, y);
  y += 7;

  addLine("Valor do imóvel:", fmtBRL(r.valorImovel));
  addLine("Entrada:", fmtBRL(r.valorEntrada));
  addLine("Valor financiado:", fmtBRL(r.valorFinanciado));
  addLine("Prazo:", `${r.prazoMeses} meses (${Math.floor(r.prazoMeses / 12)} anos)`);
  addLine("Taxa nominal:", `${r.taxaAnualNominal.toFixed(2)}% a.a. + TR ${r.trMensal.toFixed(4)}%`);
  y += 4;

  // Resultado
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resultado", 14, y);
  y += 7;

  addLine("1ª Parcela:", fmtBRL(r.primeiraParcela.parcela));
  addLine("Última Parcela:", fmtBRL(r.ultimaParcela.parcela));
  addLine("Total Pago:", fmtBRL(r.totalPago));
  addLine("Total Juros:", fmtBRL(r.totalJuros));
  addLine("Total Seguros:", fmtBRL(r.totalSeguros));
  addLine("CET Estimado:", `${r.cetAnualEstimado.toFixed(2)}% a.a.`);
  addLine("Comprometimento de Renda:", `${(r.comprometimentoRenda * 100).toFixed(1)}%`);
  addLine("Renda Mínima Exigida:", fmtBRL(r.rendaMinimaExigida));
  y += 4;

  // Composição da 1ª parcela
  doc.setFont("helvetica", "bold");
  doc.text("Composição da 1ª Parcela", 14, y);
  y += 7;
  addLine("Amortização:", fmtBRL(r.primeiraParcela.amortizacao));
  addLine("Juros:", fmtBRL(r.primeiraParcela.juros));
  addLine("Seguro MIP:", fmtBRL(r.primeiraParcela.seguroMIP));
  addLine("Seguro DFI:", fmtBRL(r.primeiraParcela.seguroDFI));
  addLine("Taxa Admin:", fmtBRL(r.primeiraParcela.taxaAdmin));
  y += 4;

  // Evolução resumida — first 12 months + last
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Evolução (primeiros 12 meses)", 14, y);
  y += 6;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  const cols = ["Mês", "Parcela", "Amort.", "Juros", "MIP", "DFI", "Saldo"];
  const colX = [14, 30, 55, 80, 105, 125, 150];
  cols.forEach((c, i) => doc.text(c, colX[i], y));
  y += 4;

  doc.setFont("helvetica", "normal");
  const rowsToShow = r.evolucao.slice(0, 12);
  rowsToShow.forEach((p) => {
    if (y > 280) { doc.addPage(); y = 20; }
    const vals = [
      String(p.mes), fmtBRL(p.parcela), fmtBRL(p.amortizacao),
      fmtBRL(p.juros), fmtBRL(p.seguroMIP), fmtBRL(p.seguroDFI), fmtBRL(p.saldoDevedor),
    ];
    vals.forEach((v, i) => doc.text(v, colX[i], y));
    y += 3.5;
  });

  // Disclaimer
  y += 8;
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  const disclaimer = `Simulação estimada para fins informativos. Taxas de balcão de ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}. O CET real e a taxa personalizada dependem de análise de crédito pelo banco.`;
  const lines = doc.splitTextToSize(disclaimer, w - 28);
  doc.text(lines, 14, y);
  y += lines.length * 3.5;

  // Corretor
  if (extras?.corretorNome) {
    y += 6;
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(extras.corretorNome, 14, y);
    if (extras.corretorCreci) { y += 4; doc.setFont("helvetica", "normal"); doc.text(`CRECI: ${extras.corretorCreci}`, 14, y); }
    if (extras.corretorTelefone) { y += 4; doc.text(`Tel: ${extras.corretorTelefone}`, 14, y); }
  }

  doc.save(`simulacao-${r.bancoId}-${r.sistema}.pdf`);
}
