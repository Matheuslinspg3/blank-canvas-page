import { useState, useCallback } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, ArrowRight, ArrowLeft, Sparkles, Eye } from "lucide-react";
import { useContractTemplates, type ContractTemplate } from "@/hooks/useContractTemplates";
import { useLeads } from "@/hooks/useLeads";
import { useProperties } from "@/hooks/useProperties";
import { useBrokers } from "@/hooks/useBrokers";
import { useContracts, type ContractFormData, type ContractType } from "@/hooks/useContracts";
import { ContractDocumentPreview } from "./ContractDocumentPreview";
import { toast } from "sonner";

interface QuickContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "template" | "data" | "done";

export function QuickContractDialog({ open, onOpenChange }: QuickContractDialogProps) {
  const { templates } = useContractTemplates();
  const { leads } = useLeads();
  const { properties } = useProperties();
  const { brokers } = useBrokers();
  const { contracts, createContract, isCreating } = useContracts();

  const [step, setStep] = useState<Step>("template");
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [leadId, setLeadId] = useState<string>("");
  const [propertyId, setPropertyId] = useState<string>("");
  const [brokerId, setBrokerId] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [paymentDay, setPaymentDay] = useState("10");
  const [readjustmentIndex, setReadjustmentIndex] = useState("IGPM");
  const [commissionPercentage, setCommissionPercentage] = useState("5");
  const [createdContractId, setCreatedContractId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const reset = useCallback(() => {
    setStep("template");
    setSelectedTemplate(null);
    setLeadId("");
    setPropertyId("");
    setBrokerId("");
    setValue("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setEndDate("");
    setPaymentDay("10");
    setReadjustmentIndex("IGPM");
    setCommissionPercentage("5");
    setCreatedContractId(null);
  }, []);

  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const isLocacao = selectedTemplate?.contract_type === "locacao";

  const handleCreate = () => {
    if (!selectedTemplate || !value) return;

    const data: ContractFormData = {
      type: (selectedTemplate.contract_type === "locacao" ? "locacao" : "venda") as ContractType,
      property_id: propertyId || null,
      lead_id: leadId || null,
      broker_id: brokerId || null,
      value: parseFloat(value),
      commission_percentage: commissionPercentage ? parseFloat(commissionPercentage) : null,
      start_date: startDate || null,
      end_date: endDate || null,
      payment_day: paymentDay ? parseInt(paymentDay) : null,
      readjustment_index: isLocacao ? readjustmentIndex : null,
      status: "rascunho",
      notes: `Criado a partir do template: ${selectedTemplate.name}`,
    };

    createContract(data);
    toast.success("Contrato criado! Você pode visualizá-lo com o template preenchido.");
    setStep("done");
  };

  const htmlTemplates = templates.filter(t => t.template_type === "html");

  // Find the newly created contract for preview
  const createdContract = contracts.find(c => 
    c.lead?.id === leadId && 
    c.property?.id === propertyId && 
    c.status === "rascunho"
  );

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Criar Contrato Rápido
            </DialogTitle>
            <DialogDescription>
              {step === "template" && "Escolha um template para começar."}
              {step === "data" && "Preencha os dados do contrato."}
              {step === "done" && "Contrato criado com sucesso!"}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Choose template */}
          {step === "template" && (
            <div className="space-y-3 py-2">
              {htmlTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Nenhum template disponível</p>
                  <p className="text-sm mt-1">Crie um template na aba "Templates" ou use os "Templates Prontos".</p>
                </div>
              ) : (
                <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {htmlTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setSelectedTemplate(t); setStep("data"); }}
                      className={`w-full text-left p-3 rounded-lg border transition-all hover:border-primary hover:bg-primary/5 ${
                        selectedTemplate?.id === t.id ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{t.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {t.contract_type === "venda" ? "Venda" : t.contract_type === "locacao" ? "Locação" : "Ambos"}
                        </Badge>
                      </div>
                      {t.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                      )}
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs text-muted-foreground">{t.variables.length} variáveis</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground ml-auto" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Fill data */}
          {step === "data" && selectedTemplate && (
            <div className="space-y-4 py-2 max-h-[500px] overflow-y-auto pr-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">{selectedTemplate.name}</Badge>
              </div>

              <div>
                <Label>Cliente (Lead) *</Label>
                <Select value={leadId} onValueChange={setLeadId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {leads.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.name} {l.email ? `(${l.email})` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Imóvel</Label>
                <Select value={propertyId} onValueChange={setPropertyId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o imóvel" /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Corretor</Label>
                <Select value={brokerId} onValueChange={setBrokerId}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecione o corretor" /></SelectTrigger>
                  <SelectContent>
                    {brokers.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$) *</Label>
                  <Input
                    type="number"
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder="350000"
                    className="mt-1.5"
                    min={1}
                    required
                  />
                </div>
                <div>
                  <Label>Comissão (%)</Label>
                  <Input
                    type="number"
                    value={commissionPercentage}
                    onChange={e => setCommissionPercentage(e.target.value)}
                    placeholder="5"
                    className="mt-1.5"
                    step="0.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data Início *</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1.5" required />
                </div>
                <div>
                  <Label>Data Fim</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1.5" />
                </div>
              </div>

              {isLocacao && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Dia Pagamento</Label>
                    <Input type="number" value={paymentDay} onChange={e => setPaymentDay(e.target.value)} className="mt-1.5" min={1} max={31} />
                  </div>
                  <div>
                    <Label>Índice de Reajuste</Label>
                    <Select value={readjustmentIndex} onValueChange={setReadjustmentIndex}>
                      <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IGPM">IGPM</SelectItem>
                        <SelectItem value="IPCA">IPCA</SelectItem>
                        <SelectItem value="INPC">INPC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setStep("template")} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-1.5"
                  onClick={handleCreate}
                  disabled={!leadId || !value || isCreating}
                >
                  {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Criar Contrato
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === "done" && (
            <div className="text-center py-6 space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Contrato criado!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  O contrato foi criado como rascunho. Você pode visualizá-lo preenchido com os dados selecionados.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                  Fechar
                </Button>
                {createdContract && (
                  <Button className="gap-1.5" onClick={() => { setPreviewOpen(true); }}>
                    <Eye className="h-4 w-4" />
                    Visualizar Contrato
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {createdContract && selectedTemplate && (
        <ContractDocumentPreview
          contract={createdContract}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          initialTemplateId={selectedTemplate.id}
        />
      )}
    </>
  );
}
