import { useState, useCallback } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  targetId: string;
}

export function ExportPdfButton({ targetId }: Props) {
  const [exporting, setExporting] = useState(false);
  const [sections, setSections] = useState({
    leads: true,
    sales: true,
    brokers: true,
    properties: true,
    costs: true,
    detailedLeads: false,
    detailedProps: false
  });

  const handleExport = useCallback(async () => {
    const selectedKeys = Object.entries(sections).filter(([_, v]) => v).map(([k]) => k);
    if (selectedKeys.length === 0) {
      toast.error("Selecione pelo menos uma seção para exportar");
      return;
    }

    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = 210;
      const pdfH = 297;
      const margin = 10;
      const contentW = pdfW - (margin * 2);
      
      let firstPage = true;

      // Define sections mapping to DOM IDs
      const sectionMap: Record<string, string> = {
        leads: "section-leads",
        sales: "section-sales",
        brokers: "section-brokers",
        properties: "section-properties",
        costs: "section-costs",
        funnel: "section-funnel",
        detailedLeads: "details", // We'll handle tabs if needed, but here IDs are better
        detailedProps: "details"
      };

      // Create a temporary container to render only selected sections for canvas
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.width = "1000px"; // Fixed width for consistent scaling
      tempContainer.style.background = "white";
      tempContainer.style.padding = "20px";
      document.body.appendChild(tempContainer);

      // Add Title and Date
      const header = document.createElement("div");
      header.innerHTML = `
        <h1 style="font-size: 24px; color: #333; margin-bottom: 5px;">Relatório de Métricas - Habitaê</h1>
        <p style="font-size: 14px; color: #666; margin-bottom: 20px;">Gerado em: ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}</p>
      `;
      tempContainer.appendChild(header);

      for (const key of selectedKeys) {
        const id = sectionMap[key];
        const el = document.getElementById(id);
        if (!el) continue;

        // Clone element to temp container
        const clone = el.cloneNode(true) as HTMLElement;
        clone.style.marginBottom = "30px";
        tempContainer.appendChild(clone);
      }

      const canvas = await html2canvas(tempContainer, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      const imgW = canvas.width;
      const imgH = canvas.height;

      // Calculate how many pages we need
      const ratio = contentW / imgW;
      const pageHeightInPx = (pdfH - (margin * 2)) / ratio;
      
      let heightLeft = imgH;
      let position = 0;

      while (heightLeft > 0) {
        if (!firstPage) pdf.addPage();
        
        pdf.addImage(imgData, "JPEG", margin, margin - position * ratio, contentW, imgH * ratio);
        
        heightLeft -= pageHeightInPx;
        position += pageHeightInPx;
        firstPage = false;
      }

      pdf.save(`relatorio-metricas-${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.removeChild(tempContainer);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      console.error("Export PDF error:", err);
      toast.error("Erro ao exportar PDF");
    } finally {
      setExporting(false);
    }
  }, [sections]);

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting} className="gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Exportar PDF
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4 space-y-4" align="end">
        <h4 className="font-medium text-sm">Seções do Relatório</h4>
        <div className="space-y-3">
          {Object.entries({
            leads: "Resumo de Leads",
            sales: "Vendas & Funil",
            brokers: "Produtividade Corretores",
            properties: "Imóveis",
            costs: "Custos & ROI",
            detailedLeads: "Lista Detalhada Leads",
            detailedProps: "Lista Detalhada Imóveis"
          }).map(([key, label]) => (
            <div key={key} className="flex items-center space-x-2">
              <Checkbox 
                id={`export-${key}`} 
                checked={sections[key as keyof typeof sections]} 
                onCheckedChange={() => toggleSection(key as keyof typeof sections)}
              />
              <Label htmlFor={`export-${key}`} className="text-xs cursor-pointer">{label}</Label>
            </div>
          ))}
        </div>
        <Button className="w-full text-xs h-9" onClick={handleExport} disabled={exporting}>
          {exporting ? "Gerando..." : "Gerar Relatório"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}

