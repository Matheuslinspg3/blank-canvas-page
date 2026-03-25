import { useRef, useState, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, FileText, Eye } from "lucide-react";
import { useContractTemplates, type ContractTemplate } from "@/hooks/useContractTemplates";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { ContractWithDetails } from "@/hooks/useContracts";
import { toast } from "sonner";

interface ContractDocumentPreviewProps {
  contract: ContractWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplateId?: string | null;
}

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const formatDate = (date: string | null | undefined) => {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
};

function replaceVariables(html: string, contract: ContractWithDetails, orgName: string): string {
  const commissionValue = contract.commission_percentage
    ? Number(contract.value) * (Number(contract.commission_percentage) / 100)
    : 0;

  const vars: Record<string, string> = {
    "{{nome_cliente}}": contract.lead?.name || "—",
    "{{email_cliente}}": contract.lead?.email || "—",
    "{{telefone_cliente}}": contract.lead?.phone || "—",
    "{{cpf_cliente}}": "—",
    "{{endereco_imovel}}": contract.property?.address_city || "—",
    "{{codigo_imovel}}": contract.property?.id?.slice(0, 8).toUpperCase() || "—",
    "{{titulo_imovel}}": contract.property?.title || "—",
    "{{valor_contrato}}": formatCurrency(Number(contract.value)),
    "{{tipo_contrato}}": contract.type === "venda" ? "Venda" : "Locação",
    "{{data_inicio}}": formatDate(contract.start_date),
    "{{data_fim}}": formatDate(contract.end_date),
    "{{corretor_nome}}": contract.broker?.full_name || "—",
    "{{comissao}}": contract.commission_percentage ? `${contract.commission_percentage}%` : "—",
    "{{valor_comissao}}": formatCurrency(commissionValue),
    "{{dia_pagamento}}": contract.payment_day ? String(contract.payment_day) : "—",
    "{{indice_reajuste}}": contract.readjustment_index || "—",
    "{{data_atual}}": format(new Date(), "dd/MM/yyyy", { locale: ptBR }),
    "{{codigo_contrato}}": contract.code,
    "{{nome_imobiliaria}}": orgName,
  };

  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(key).join(value);
  }
  return result;
}

export function ContractDocumentPreview({
  contract,
  open,
  onOpenChange,
  initialTemplateId,
}: ContractDocumentPreviewProps) {
  const { templates } = useContractTemplates();
  const { profile } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialTemplateId || null);
  const [downloading, setDownloading] = useState(false);
  const [orgName, setOrgName] = useState("");

  // Fetch org name on open
  const fetchOrgName = useCallback(async () => {
    if (!profile?.organization_id) return;
    const { data } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", profile.organization_id)
      .single();
    if (data) setOrgName(data.name);
  }, [profile?.organization_id]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      fetchOrgName();
      if (initialTemplateId) setSelectedTemplateId(initialTemplateId);
    }
  }, [open, fetchOrgName, initialTemplateId]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null;

  // Auto-select default or matching template
  const matchingTemplates = templates.filter(
    (t) => t.contract_type === contract.type || t.contract_type === "ambos"
  );

  if (!selectedTemplateId && matchingTemplates.length > 0) {
    const defaultTpl = matchingTemplates.find((t) => t.is_default) || matchingTemplates[0];
    if (defaultTpl) {
      // Use setTimeout to avoid setState during render
      setTimeout(() => setSelectedTemplateId(defaultTpl.id), 0);
    }
  }

  const renderedHtml = selectedTemplate
    ? replaceVariables(selectedTemplate.body_html, contract, orgName)
    : null;

  const handleDownloadPdf = async () => {
    if (!contentRef.current) return;
    setDownloading(true);

    try {
      // Dynamic import to avoid bundling when not needed
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 190;
      const pageHeight = 277;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`contrato_${contract.code}.pdf`);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error("Error generating PDF:", err);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Visualizar Contrato
          </DialogTitle>
        </DialogHeader>

        {/* Template selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex-1 w-full">
            <Select
              value={selectedTemplateId || undefined}
              onValueChange={setSelectedTemplateId}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Selecione um template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}{" "}
                    <span className="text-muted-foreground">
                      ({tpl.contract_type === "venda" ? "Venda" : tpl.contract_type === "locacao" ? "Locação" : "Ambos"})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 min-h-[44px] shrink-0"
            disabled={!renderedHtml || downloading}
            onClick={handleDownloadPdf}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Baixar PDF
          </Button>
        </div>

        {/* Contract info summary */}
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{contract.code}</Badge>
          <Badge variant="secondary">{contract.type === "venda" ? "Venda" : "Locação"}</Badge>
          {contract.lead && <Badge variant="outline">👤 {contract.lead.name}</Badge>}
          {contract.property && <Badge variant="outline">🏠 {contract.property.title}</Badge>}
          <Badge variant="outline">{formatCurrency(Number(contract.value))}</Badge>
        </div>

        {/* Rendered document */}
        {renderedHtml ? (
          <div
            ref={contentRef}
            className="prose prose-sm max-w-none border rounded-lg p-8 bg-white text-black shadow-sm min-h-[400px]"
            style={{ fontFamily: "Georgia, serif", lineHeight: 1.8 }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderedHtml) }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 border rounded-lg bg-muted/30">
            <FileText className="h-12 w-12 opacity-40" />
            <p className="text-sm font-medium">
              {templates.length === 0
                ? "Nenhum template de contrato cadastrado."
                : "Selecione um template para visualizar o contrato."}
            </p>
            {templates.length === 0 && (
              <p className="text-xs">
                Crie templates em Financeiro → Templates de Contrato.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
