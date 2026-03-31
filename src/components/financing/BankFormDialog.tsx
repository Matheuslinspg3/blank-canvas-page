import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { FinancingProcess, BANK_FORMS, BANK_COLORS } from "./types";
import { generateBankForm } from "./BankFormGenerator";

interface BankFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: FinancingProcess | null;
}

export function BankFormDialog({ open, onOpenChange, process }: BankFormDialogProps) {
  if (!process) return null;

  const forms = BANK_FORMS[process.bank] || [];
  const bankInfo = BANK_COLORS[process.bank];

  const handleGenerate = (formId: string, formName: string) => {
    try {
      generateBankForm(process, formId);
      toast.success(`"${formName}" gerado com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar formulário");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerar Formulários
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Cliente: <span className="font-medium text-foreground">{process.clientName}</span>
          </p>
          {bankInfo && (
            <p className="text-sm text-muted-foreground">
              Banco: <span className="font-medium text-foreground">{bankInfo.name}</span>
            </p>
          )}
        </div>

        <div className="space-y-2 mt-2">
          {forms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum formulário disponível para este banco.
            </p>
          ) : (
            forms.map((form) => (
              <Card key={form.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{form.name}</p>
                    <p className="text-xs text-muted-foreground">{form.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGenerate(form.id, form.name)}
                    className="shrink-0"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    PDF
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
