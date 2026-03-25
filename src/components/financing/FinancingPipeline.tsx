import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, User, Building2, Phone, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface FinancingProcess {
  id: string;
  clientName: string;
  clientPhone: string;
  propertyValue: number;
  financingValue: number;
  bank: string;
  stage: string;
  createdAt: Date;
}

const STAGES = [
  { id: "analise_credito", label: "Análise de Crédito", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  { id: "documentacao", label: "Documentação", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  { id: "avaliacao", label: "Avaliação", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  { id: "contrato", label: "Contrato", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  { id: "liberacao", label: "Liberação", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
];

export function FinancingPipeline() {
  const [processes, setProcesses] = useState<FinancingProcess[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ clientName: "", clientPhone: "", propertyValue: "", financingValue: "", bank: "caixa" });

  const handleCreate = () => {
    if (!form.clientName) { toast.error("Informe o nome do cliente"); return; }
    const newProc: FinancingProcess = {
      id: crypto.randomUUID(),
      clientName: form.clientName,
      clientPhone: form.clientPhone,
      propertyValue: parseFloat(form.propertyValue.replace(/\D/g, "")) || 0,
      financingValue: parseFloat(form.financingValue.replace(/\D/g, "")) || 0,
      bank: form.bank,
      stage: "analise_credito",
      createdAt: new Date(),
    };
    setProcesses((prev) => [...prev, newProc]);
    setForm({ clientName: "", clientPhone: "", propertyValue: "", financingValue: "", bank: "caixa" });
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
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Processo de Financiamento</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do cliente</Label>
                <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor do imóvel</Label>
                  <Input value={form.propertyValue} onChange={(e) => setForm({ ...form, propertyValue: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Valor financiado</Label>
                  <Input value={form.financingValue} onChange={(e) => setForm({ ...form, financingValue: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Banco</Label>
                <Select value={form.bank} onValueChange={(v) => setForm({ ...form, bank: v })}>
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
              <Button onClick={handleCreate} className="w-full">Criar Processo</Button>
            </div>
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
                        {stage.id !== "liberacao" && (
                          <Button size="sm" variant="ghost" className="w-full text-xs h-7" onClick={() => moveNext(proc.id)}>
                            Avançar <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
