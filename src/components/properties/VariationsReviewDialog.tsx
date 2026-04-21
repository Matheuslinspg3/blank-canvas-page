import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { VariationRow, VariationError, isRowEmpty } from "@/hooks/usePropertyBatchCreate";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VariationsReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: VariationRow[];
  errors: VariationError[];
  isCreating: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

const statusLabels: Record<string, string> = {
  disponivel: "Disponível",
  inativo: "Inativo",
  reservado: "Reservado",
};

export function VariationsReviewDialog({
  open,
  onOpenChange,
  rows,
  errors,
  isCreating,
  onConfirm,
  onBack,
}: VariationsReviewDialogProps) {
  const validRows = rows.filter((r) => !isRowEmpty(r));
  const hasErrors = errors.length > 0;

  const errorsByRow = new Map<number, VariationError[]>();
  errors.forEach((e) => {
    if (!errorsByRow.has(e.rowIndex)) errorsByRow.set(e.rowIndex, []);
    errorsByRow.get(e.rowIndex)!.push(e);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
            Revisão — {validRows.length} imóveis
          </DialogTitle>
          <DialogDescription>
            {hasErrors
              ? `Foram encontrados ${errors.length} erros. Corrija antes de continuar.`
              : "Todos os dados estão válidos. Confirme para criar os imóveis."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-2">
            {validRows.map((row, i) => {
              const rowErrors = errorsByRow.get(i);
              return (
                <div
                  key={row.id}
                  className={`p-3 rounded-lg border text-sm ${
                    rowErrors ? "border-destructive/50 bg-destructive/5" : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                      {row.unit_label && <Badge variant="secondary">{row.unit_label}</Badge>}
                      {row.property_code && (
                        <span className="text-xs text-muted-foreground">Cód: {row.property_code}</span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {statusLabels[row.status] || row.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {row.bedrooms != null && <span>{row.bedrooms} quartos</span>}
                    {row.suites != null && <span>{row.suites} suítes</span>}
                    {row.bathrooms != null && <span>{row.bathrooms} banh.</span>}
                    {row.parking_spots != null && <span>{row.parking_spots} vagas</span>}
                    {row.area_total != null && <span>{row.area_total}m²</span>}
                    {row.sale_price != null && (
                      <span className="font-medium text-foreground">
                        R$ {row.sale_price.toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                  {row.notes && <p className="text-xs text-muted-foreground mt-1 italic">{row.notes}</p>}
                  {rowErrors && (
                    <div className="mt-2 space-y-1">
                      {rowErrors.map((e, ei) => (
                        <p key={ei} className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {e.message}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onBack} disabled={isCreating}>
            Voltar para editar
          </Button>
          <Button onClick={onConfirm} disabled={hasErrors || isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...
              </>
            ) : (
              `Criar ${validRows.length} imóveis`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
