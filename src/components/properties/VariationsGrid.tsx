import { useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CopyPlus, Trash2 } from "lucide-react";
import { VariationRow, VariationError, createEmptyRow } from "@/hooks/usePropertyBatchCreate";
import { cn } from "@/lib/utils";
import { VARIATION_COLUMNS } from "@/lib/propertyFieldMappings";

interface VariationsGridProps {
  rows: VariationRow[];
  onChange: (rows: VariationRow[]) => void;
  errors?: VariationError[];
}

const COLUMNS = VARIATION_COLUMNS;

type ColumnKey = string;

export function VariationsGrid({ rows, onChange, errors = [] }: VariationsGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const getFieldError = (rowIndex: number, field: string) =>
    errors.find((e) => e.rowIndex === rowIndex && e.field === field);

  const parseLocalizedNumber = useCallback((value: string): number | null => {
    if (!value || value.trim() === "") return null;
    // Handle Brazilian format: 450.000,50 → 450000.50
    // If value contains both dots and commas, dots are thousands separators
    const hasComma = value.includes(",");
    const hasDot = value.includes(".");
    let sanitized = value;
    if (hasComma && hasDot) {
      // 450.000,50 → 450000.50
      sanitized = value.replace(/\./g, "").replace(",", ".");
    } else if (hasComma && !hasDot) {
      // 450000,50 → 450000.50 OR 450,000 → could be ambiguous
      // If comma is followed by exactly 3 digits at end, treat as thousands separator
      if (/,\d{3}$/.test(value) && !/,\d{1,2}$/.test(value)) {
        sanitized = value.replace(",", "");
      } else {
        sanitized = value.replace(",", ".");
      }
    } else if (hasDot && !hasComma) {
      // 450.000 → could be 450 (decimal) or 450000 (thousands)
      // If dot is followed by exactly 3 digits at end, treat as thousands separator
      if (/\.\d{3}$/.test(value) && (value.match(/\./g) || []).length >= 1) {
        sanitized = value.replace(/\./g, "");
      }
      // else keep as-is (e.g. 450.5 stays 450.5)
    }
    const num = Number(sanitized);
    return isNaN(num) ? null : num;
  }, []);

  const updateRow = useCallback(
    (rowId: string, field: ColumnKey, value: string) => {
      onChange(
        rows.map((r) => {
          if (r.id !== rowId) return r;
          const col = COLUMNS.find((c) => c.key === field)!;
          const updated = { ...r };
          if (col.type === "number") {
            const num = parseLocalizedNumber(value);
            return { ...updated, [field]: num };
          }
          return { ...updated, [field]: value };
        })
      );
    },
    [rows, onChange, parseLocalizedNumber]
  );

  const addRow = () => onChange([...rows, createEmptyRow()]);

  const duplicateRow = (index: number) => {
    const source = rows[index];
    const dup: VariationRow = { ...source, id: crypto.randomUUID(), property_code: "", unit_label: "" };
    const next = [...rows];
    next.splice(index + 1, 0, dup);
    onChange(next);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    onChange(rows.filter((_, i) => i !== index));
  };

  // Handle paste from Excel (TSV)
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text.includes("\t") && !text.includes("\n")) return; // not tabular data
      e.preventDefault();

      const pastedRows = text
        .split("\n")
        .map((line) => line.split("\t").map((cell) => cell.trim()))
        .filter((cells) => cells.some((c) => c));

      if (pastedRows.length === 0) return;

      const newRows: VariationRow[] = pastedRows.map((cells) => {
        const row = createEmptyRow();
        COLUMNS.forEach((col, ci) => {
          if (ci < cells.length && cells[ci]) {
            const val = cells[ci];
            if (col.type === "number") {
              const cleaned = val.replace(/[^\d.,\-]/g, "");
              const hasComma = cleaned.includes(",");
              const hasDot = cleaned.includes(".");
              let sanitized = cleaned;
              if (hasComma && hasDot) {
                sanitized = cleaned.replace(/\./g, "").replace(",", ".");
              } else if (hasComma) {
                if (/,\d{3}$/.test(cleaned)) {
                  sanitized = cleaned.replace(",", "");
                } else {
                  sanitized = cleaned.replace(",", ".");
                }
              } else if (hasDot && /\.\d{3}$/.test(cleaned)) {
                sanitized = cleaned.replace(/\./g, "");
              }
              const num = Number(sanitized);
              (row as any)[col.key] = isNaN(num) ? null : num;
            } else {
              (row as any)[col.key] = val;
            }
          }
        });
        return row;
      });

      onChange([...rows, ...newRows]);
    },
    [rows, onChange]
  );

  return (
    <div ref={containerRef} onPaste={handlePaste} className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10 text-center text-xs">#</TableHead>
              {COLUMNS.map((col) => (
                <TableHead key={col.key} className="text-xs whitespace-nowrap min-w-[80px]">
                  {col.label}
                </TableHead>
              ))}
              <TableHead className="w-20 text-center text-xs">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIdx) => (
              <TableRow key={row.id} className="group">
                <TableCell className="text-center text-xs text-muted-foreground font-mono">
                  {rowIdx + 1}
                </TableCell>
                {COLUMNS.map((col) => {
                  const fieldError = getFieldError(rowIdx, col.key);
                  if (col.key === "status") {
                    return (
                      <TableCell key={col.key} className="p-1">
                        <Select
                          value={row.status}
                          onValueChange={(v) => updateRow(row.id, "status", v)}
                        >
                          <SelectTrigger className={cn("h-8 text-xs min-w-[100px]", fieldError && "border-destructive")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="disponivel">Disponível</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                            <SelectItem value="reservado">Reservado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    );
                  }
                  return (
                    <TableCell key={col.key} className="p-1">
                      <Input
                        type={col.key === "sale_price" ? "text" : col.type === "number" ? "number" : "text"}
                        inputMode={col.key === "sale_price" ? "numeric" : undefined}
                        value={
                          col.type === "number"
                            ? (row as any)[col.key] ?? ""
                            : (row as any)[col.key] || ""
                        }
                        onChange={(e) => updateRow(row.id, col.key, e.target.value)}
                        placeholder={"placeholder" in col ? col.placeholder : ""}
                        className={cn(
                          "h-8 text-xs min-w-[70px]",
                          col.key === "notes" && "min-w-[120px]",
                          col.key === "sale_price" && "min-w-[100px]",
                          fieldError && "border-destructive"
                        )}
                      />
                      {fieldError && (
                        <span className="text-[10px] text-destructive leading-none">{fieldError.message}</span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell className="p-1">
                  <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => duplicateRow(rowIdx)}
                      title="Duplicar linha"
                    >
                      <CopyPlus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeRow(rowIdx)}
                      disabled={rows.length <= 1}
                      title="Excluir linha"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar linha
        </Button>
        <span className="text-xs text-muted-foreground">
          💡 Dica: você pode colar dados do Excel diretamente na tabela
        </span>
      </div>
    </div>
  );
}
