import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Plus, User, Building2, Phone, ArrowRight, FileText } from "lucide-react";
import { toast } from "sonner";
import { FinancingProcess, STAGES, EMPTY_FORM } from "./types";
import { BankFormDialog } from "./BankFormDialog";

const UF_OPTIONS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

export function FinancingPipeline() {
  const [processes, setProcesses] = useState<FinancingProcess[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formDialogProc, setFormDialogProc] = useState<FinancingProcess | null>(null);

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleCreate = () => {
    if (!form.clientName) { toast.error("Informe o nome do cliente"); return; }
    const newProc: FinancingProcess = {
      ...form,
      id: crypto.randomUUID(),
      stage: "analise_credito",
      createdAt: new Date(),
    };
    setProcesses((prev) => [...prev, newProc]);
    setForm({ ...EMPTY_FORM });
    setNewOpen(false);
    toast.success("Processo criado!");
  };

  const moveNext = (id: string) => {
    setProcesses((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const idx = STAGES.findIndex((s) => s.id === p.stage);
        if (idx < STAGES.length - 1) return { ...p, stage: STAGES[idx + 1].id };
        return p;
      })
    );
  };

  const fmtBRL = (v: number) => v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "-";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pipeline de Financiamentos</h3>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Novo Processo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Processo de Financiamento</DialogTitle></DialogHeader>
            <Accordion type="multiple" defaultValue={["basico"]} className="w-full">
              {/* Step 1 */}
              <AccordionItem value="basico">
                <AccordionTrigger className="text-sm font-medium">1. Dados Básicos</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do cliente *</Label>
                    <Input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">CPF</Label>
                      <Input value={form.clientCpf} onChange={(e) => set("clientCpf", e.target.value)} placeholder="000.000.000-00" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">RG</Label>
                      <Input value={form.clientRg} onChange={(e) => set("clientRg", e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Telefone</Label>
                      <Input value={form.clientPhone} onChange={(e) => set("clientPhone", e.target.value)} placeholder="(11) 99999-9999" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">E-mail</Label>
                      <Input value={form.clientEmail} onChange={(e) => set("clientEmail", e.target.value)} placeholder="email@exemplo.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data de Nascimento</Label>
                      <Input type="date" value={form.clientBirthDate} onChange={(e) => set("clientBirthDate", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Estado Civil</Label>
                      <Select value={form.clientMaritalStatus} onValueChange={(v) => set("clientMaritalStatus", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                          <SelectItem value="casado">Casado(a)</SelectItem>
                          <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                          <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                          <SelectItem value="uniao_estavel">União Estável</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Step 2 */}
              <AccordionItem value="pessoal">
                <AccordionTrigger className="text-sm font-medium">2. Dados Pessoais</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Nacionalidade</Label>
                      <Input value={form.clientNationality} onChange={(e) => set("clientNationality", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Profissão</Label>
                      <Input value={form.clientOccupation} onChange={(e) => set("clientOccupation", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Renda Mensal Bruta (R$)</Label>
                    <Input type="number" value={form.clientMonthlyIncome || ""} onChange={(e) => set("clientMonthlyIncome", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Endereço</Label>
                    <Input value={form.clientAddress} onChange={(e) => set("clientAddress", e.target.value)} placeholder="Rua, nº, complemento" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cidade</Label>
                      <Input value={form.clientCity} onChange={(e) => set("clientCity", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">UF</Label>
                      <Select value={form.clientState} onValueChange={(v) => set("clientState", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UF_OPTIONS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">CEP</Label>
                      <Input value={form.clientCep} onChange={(e) => set("clientCep", e.target.value)} placeholder="00000-000" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Step 3 */}
              <AccordionItem value="imovel">
                <AccordionTrigger className="text-sm font-medium">3. Imóvel e Financiamento</AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Banco</Label>
                    <Select value={form.bank} onValueChange={(v) => set("bank", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caixa">Caixa Econômica</SelectItem>
                        <SelectItem value="bb">Banco do Brasil</SelectItem>
                        <SelectItem value="itau">Itaú</SelectItem>
                        <SelectItem value="bradesco">Bradesco</SelectItem>
                        <SelectItem value="santander">Santander</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor do Imóvel (R$)</Label>
                      <Input type="number" value={form.propertyValue || ""} onChange={(e) => set("propertyValue", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Valor Financiado (R$)</Label>
                      <Input type="number" value={form.financingValue || ""} onChange={(e) => set("financingValue", parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Entrada (R$)</Label>
                      <Input type="number" value={form.downPayment || ""} onChange={(e) => set("downPayment", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prazo (meses)</Label>
                      <Input type="number" value={form.financingTermMonths || ""} onChange={(e) => set("financingTermMonths", parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Endereço do Imóvel</Label>
                    <Input value={form.propertyAddress} onChange={(e) => set("propertyAddress", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cidade</Label>
                      <Input value={form.propertyCity} onChange={(e) => set("propertyCity", e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">UF</Label>
                      <Select value={form.propertyState} onValueChange={(v) => set("propertyState", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UF_OPTIONS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Matrícula</Label>
                      <Input value={form.propertyRegistration} onChange={(e) => set("propertyRegistration", e.target.value)} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={form.useFgts} onCheckedChange={(v) => set("useFgts", v)} />
                    <Label className="text-xs">Utilizar FGTS</Label>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <Button onClick={handleCreate} className="w-full mt-2">Criar Processo</Button>
          </DialogContent>
        </Dialog>
      </div>

      {processes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum processo de financiamento.</p>
            <p className="text-sm">Clique em "Novo Processo" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {STAGES.map((stage) => {
            const items = processes.filter((p) => p.stage === stage.id);
            return (
              <div key={stage.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={stage.color}>{stage.label}</Badge>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {items.map((proc) => (
                    <Card key={proc.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium truncate">{proc.clientName}</span>
                        </div>
                        {proc.clientPhone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{proc.clientPhone}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">{fmtBRL(proc.financingValue)}</p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => setFormDialogProc(proc)}>
                            <FileText className="h-3 w-3 mr-1" /> Formulários
                          </Button>
                          {stage.id !== "liberacao" && (
                            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => moveNext(proc.id)}>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BankFormDialog
        open={!!formDialogProc}
        onOpenChange={(open) => { if (!open) setFormDialogProc(null); }}
        process={formDialogProc}
      />
    </div>
  );
}
