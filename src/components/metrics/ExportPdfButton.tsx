import { useState, useCallback } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  targetId: string;
}

export function ExportPdfButton({ targetId }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const el = document.getElementById(targetId);
      if (!el) throw new Error("Elemento não encontrado");

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(el, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.85);
      const imgW = canvas.width;
      const imgH = canvas.height;

      const pdfW = 210;
      const pdfH = (imgH * pdfW) / imgW;

      const pdf = new jsPDF("p", "mm", [pdfW, Math.max(pdfH, 297)]);
      pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH);
      pdf.save(`metricas-${new Date().toISOString().slice(0, 10)}.pdf`);

      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("Export PDF error:", err);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  }, [targetId]);

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-2">
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Exportar PDF
    </Button>
  );
}
