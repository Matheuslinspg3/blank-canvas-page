import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, Eye, Loader2 } from "lucide-react";
import { VariationsGrid } from "./VariationsGrid";
import { VariationsReviewDialog } from "./VariationsReviewDialog";
import { BatchImportReport } from "./BatchImportReport";
import {
  usePropertyBatchCreate,
  VariationRow,
  VariationError,
  BatchResult,
  createRowFromBase,
  isRowEmpty,
} from "@/hooks/usePropertyBatchCreate";
import type { PropertyWithDetails } from "@/hooks/useProperties";


interface BatchVariationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseProperty: PropertyWithDetails;
  onComplete?: (groupId?: string) => void;
}

export function BatchVariationsDialog({
  open,
  onOpenChange,
  baseProperty,
  onComplete,
}: BatchVariationsDialogProps) {
  const p = baseProperty as any;
  const { createBatch, isCreating, progress, resetProgress, validateRows } = usePropertyBatchCreate();

  const [rows, setRows] = useState<VariationRow[]>(() => [
    createRowFromBase(p),
    createRowFromBase(p),
    createRowFromBase(p),
  ]);
  const [errors, setErrors] = useState<VariationError[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [reportResult, setReportResult] = useState<BatchResult | null>(null);
  const [reportRows, setReportRows] = useState<VariationRow[]>([]);

  const validCount = rows.filter((r) => !isRowEmpty(r)).length;

  const handleReview = useCallback(async () => {
    setIsValidating(true);
    try {
      const nonEmptyRows = rows.filter((r) => !isRowEmpty(r));
      const validationErrors = await validateRows(nonEmptyRows);

      // Map filtered indices back to original row indices
      const nonEmptyIndices = rows
        .map((r, i) => (!isRowEmpty(r) ? i : -1))
        .filter((i) => i !== -1);
      const remappedErrors = validationErrors.map((e) => ({
        ...e,
        rowIndex: nonEmptyIndices[e.rowIndex] ?? e.rowIndex,
      }));

      setErrors(remappedErrors);
      setReviewOpen(true);
    } finally {
      setIsValidating(false);
    }
  }, [rows, validateRows]);

  const handleConfirm = useCallback(async () => {
    resetProgress();
    const nonEmptyRows = rows.filter((r) => !isRowEmpty(r));
    try {
      const result = await createBatch({ baseProperty, rows: nonEmptyRows });
      setReviewOpen(false);
      setReportRows(nonEmptyRows);
      setReportResult(result);
    } catch {
      // error handled by mutation
    }
  }, [rows, baseProperty, createBatch, resetProgress]);

  const handleCloseReport = (openState: boolean) => {
    if (!openState) {
      const groupId = reportResult?.groupId;
      setReportResult(null);
      setReportRows([]);
      onOpenChange(false);
      onComplete?.(groupId);
    }
  };

  const handleBack = () => setReviewOpen(false);

  const address = [p.address_neighborhood, p.address_city, p.address_state].filter(Boolean).join(", ");

  return (
    <>
      <Dialog open={open && !reviewOpen && !reportResult} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Duplicar com variações</DialogTitle>
            <DialogDescription>
              Crie múltiplos imóveis a partir de um modelo base. Edite apenas os campos que variam.
            </DialogDescription>
          </DialogHeader>

          {/* Base property summary */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                <Home className="h-3 w-3 mr-1" /> Imóvel base
              </Badge>
              <span className="text-sm font-medium">{p.title || "Sem título"}</span>
              {p.property_code && (
                <span className="text-xs text-muted-foreground font-mono">#{p.property_code}</span>
              )}
            </div>
            {address && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {address}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Os dados acima serão herdados por todos os imóveis criados. Preencha abaixo apenas o que varia.
            </p>
          </div>

          {/* Grid */}
          <div className="flex-1 min-h-0 overflow-auto">
            <VariationsGrid rows={rows} onChange={setRows} errors={reviewOpen ? errors : []} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {validCount} {validCount === 1 ? "imóvel" : "imóveis"} para criar
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleReview} disabled={validCount === 0 || isValidating}>
                {isValidating ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Validando...</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" /> Revisar ({validCount})</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <VariationsReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        rows={rows.filter((r) => !isRowEmpty(r))}
        errors={errors}
        isCreating={isCreating}
        progress={progress}
        onConfirm={handleConfirm}
        onBack={handleBack}
      />

      {reportResult && (
        <BatchImportReport
          open={!!reportResult}
          onOpenChange={handleCloseReport}
          result={reportResult}
          rows={reportRows}
        />
      )}
    </>
  );
}
