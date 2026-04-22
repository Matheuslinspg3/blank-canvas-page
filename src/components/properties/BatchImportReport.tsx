import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import type { BatchResult, VariationRow } from "@/hooks/usePropertyBatchCreate";

interface BatchImportReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: BatchResult;
  rows: VariationRow[];
}

export function BatchImportReport({ open, onOpenChange, result, rows }: BatchImportReportProps) {
  const total = result.created + result.failed;
  const allSuccess = result.failed === 0;

  // Map errors by rowIndex for quick lookup
  const errorsByRow = new Map<number, string>();
  result.errors.forEach((e) => {
    errorsByRow.set(e.rowIndex, e.message);
  });

  const handleExportCSV = () => {
    const headers = ["Linha", "Unidade", "Código", "Status", "Motivo"];
    const csvRows = rows.map((row, i) => {
      const error = errorsByRow.get(i);
      return [
        i + 1,
        row.unit_label || "-",
        row.property_code || "-",
        error ? "Falhou" : "Criado",
        error || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-importacao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {allSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            Relatório de Importação
          </DialogTitle>
          <DialogDescription>
            {allSuccess
              ? `Todos os ${total} imóveis foram criados com sucesso.`
              : `${result.created} de ${total} imóveis criados. ${result.failed} falharam.`}
          </DialogDescription>
        </DialogHeader>

        {/* Summary badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            {result.created} criados
          </Badge>
          {result.failed > 0 && (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              {result.failed} com erro
            </Badge>
          )}
          {result.strippedColumns.length > 0 && (
            <Badge variant="outline" className="gap-1 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              Colunas ignoradas: {result.strippedColumns.join(", ")}
            </Badge>
          )}
        </div>

        {/* Per-row details */}
        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-1.5">
            {rows.map((row, i) => {
              const error = errorsByRow.get(i);
              const isSuccess = !error;
              return (
                <div
                  key={row.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border text-sm ${
                    isSuccess
                      ? "border-border bg-muted/20"
                      : "border-destructive/40 bg-destructive/5"
                  }`}
                >
                  {isSuccess ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}

                  <span className="font-mono text-xs text-muted-foreground w-6">
                    {i + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {row.unit_label && (
                        <span className="font-medium text-sm">{row.unit_label}</span>
                      )}
                      {row.property_code && (
                        <span className="text-xs text-muted-foreground font-mono">
                          #{row.property_code}
                        </span>
                      )}
                      {row.sale_price != null && (
                        <span className="text-xs text-muted-foreground">
                          R$ {row.sale_price.toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                    {error && (
                      <p className="text-xs text-destructive mt-0.5">{error}</p>
                    )}
                  </div>

                  <Badge
                    variant={isSuccess ? "secondary" : "destructive"}
                    className="text-[10px] shrink-0"
                  >
                    {isSuccess ? "Criado" : "Falhou"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          {result.failed > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
