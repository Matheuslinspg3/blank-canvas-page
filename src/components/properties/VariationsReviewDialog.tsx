import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { VariationRow, VariationError, BatchProgress, isRowEmpty } from "@/hooks/usePropertyBatchCreate";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

interface VariationsReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: VariationRow[];
  errors: VariationError[];
  isCreating: boolean;
  progress: BatchProgress;
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
  progress,
  onConfirm,
  onBack,
}: VariationsReviewDialogProps) {
  const validRows = rows.filter((r) => !isRowEmpty(r));
  const hasErrors = errors.length > 0;
  const isRunning = progress.status === 'inserting' || progress.status === 'preparing';
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const errorsByRow = new Map<number, VariationError[]>();
  errors.forEach((e) => {
    if (!errorsByRow.has(e.rowIndex)) errorsByRow.set(e.rowIndex, []);
    errorsByRow.get(e.rowIndex)!.push(e);
  });

  // Build a map of row results for live status
  const rowResultMap = new Map<number, { success: boolean; message?: string }>();
  progress.rowResults.forEach((r) => rowResultMap.set(r.rowIndex, r));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isRunning ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : hasErrors ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
            {isRunning
              ? `Criando imóveis... ${progress.current}/${progress.total}`
              : `Revisão — ${validRows.length} imóveis`}
          </DialogTitle>
          <DialogDescription>
            {isRunning
              ? `Processando: ${progress.currentLabel}`
              : hasErrors
                ? `Foram encontrados ${errors.length} erros. Corrija antes de continuar.`
                : "Todos os dados estão válidos. Confirme para criar os imóveis."}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar during creation */}
        {isRunning && (
          <div className="space-y-2">
            <Progress value={pct} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.currentLabel}</span>
              <span>{pct}%</span>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-2">
            {validRows.map((row, i) => {
              const rowErrors = errorsByRow.get(i);
              const liveResult = rowResultMap.get(i);
              const isPending = isRunning && !liveResult && i >= progress.current;

              return (
                <div
                  key={row.id}
                  className={`p-3 rounded-lg border text-sm transition-colors ${
                    liveResult?.success === false
                      ? "border-destructive/50 bg-destructive/5"
                      : liveResult?.success === true
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : rowErrors
                          ? "border-destructive/50 bg-destructive/5"
                          : isPending
                            ? "border-border bg-muted/10 opacity-50"
                            : "border-border bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Live status icon */}
                      {liveResult?.success === true && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                      {liveResult?.success === false && (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      )}
                      {isRunning && !liveResult && i === progress.current && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      )}
                      <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                      {row.unit_label && <Badge variant="secondary">{row.unit_label}</Badge>}
                      {row.property_code && (
                        <span className="text-xs text-muted-foreground">Cód: {row.property_code}</span>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {liveResult?.success === true
                        ? "✓ Criado"
                        : liveResult?.success === false
                          ? "✗ Falhou"
                          : statusLabels[row.status] || row.status}
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
                  {/* Validation errors */}
                  {rowErrors && (
                    <div className="mt-2 space-y-1">
                      {rowErrors.map((e, ei) => (
                        <p key={ei} className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> {e.message}
                        </p>
                      ))}
                    </div>
                  )}
                  {/* Live insertion error */}
                  {liveResult?.success === false && liveResult.message && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> {liveResult.message}
                    </p>
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
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando {progress.current}/{progress.total}...
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
