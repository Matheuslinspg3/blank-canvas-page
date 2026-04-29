import { useMemo, useState } from "react";
import { Check, ChevronDown, X, Search, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface MultiSelectOption {
  value: string;
  label: string;
  count?: number;
}

interface MultiSelectFilterProps {
  /** Selected values (controlled). */
  value: string[];
  /** Callback when selection changes. */
  onChange: (next: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Trigger label when nothing selected. */
  triggerLabel?: string;
  className?: string;
  triggerClassName?: string;
  /** Limit height of the list. */
  maxHeight?: string;
  /** Disable the entire control. */
  disabled?: boolean;
  /** Optional id used for aria/testing. */
  id?: string;
  /** Loading state — renders skeleton inside the popover instead of the empty list. */
  isLoading?: boolean;
  /** Error state — renders a friendly error message inside the popover. */
  error?: Error | string | null;
  /** Custom message when there are zero options (and not loading/error). */
  emptyOptionsText?: string;
}

/**
 * Multi-select filter built on Popover + searchable list with checkboxes.
 * Logic between selected items is OR (matches any).
 *
 * Usage:
 * ```tsx
 * <MultiSelectFilter
 *   value={cities}
 *   onChange={setCities}
 *   options={[{ value: "santos", label: "Santos", count: 12 }]}
 *   triggerLabel="Cidades"
 * />
 * ```
 */
export function MultiSelectFilter({
  value,
  onChange,
  options,
  placeholder = "Selecionar...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum resultado",
  triggerLabel,
  className,
  triggerClassName,
  maxHeight = "260px",
  disabled,
  id,
  isLoading = false,
  error = null,
  emptyOptionsText = "Nenhuma opção disponível",
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredOptions = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return options;
    return options.filter((o) => o.label.toLowerCase().includes(s));
  }, [options, search]);

  const toggle = (val: string) => {
    if (value.includes(val)) {
      onChange(value.filter((v) => v !== val));
    } else {
      onChange([...value, val]);
    }
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectAllVisible = () => {
    const visibleValues = filteredOptions.map((o) => o.value);
    const merged = Array.from(new Set([...value, ...visibleValues]));
    onChange(merged);
  };

  const triggerText = (() => {
    if (value.length === 0) return triggerLabel ?? placeholder;
    if (value.length === 1) {
      const sel = options.find((o) => o.value === value[0]);
      return sel?.label ?? value[0];
    }
    return `${triggerLabel ?? placeholder}: ${value.length}`;
  })();

  return (
    <div className={cn("inline-flex", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled}
            id={id}
            className={cn(
              "justify-between gap-2 min-h-9 font-normal",
              value.length > 0 && "border-primary/40",
              triggerClassName,
            )}
          >
            <span className="truncate">{triggerText}</span>
            <div className="flex items-center gap-1 shrink-0">
              {value.length > 0 && (
                <span
                  role="button"
                  aria-label="Limpar"
                  tabIndex={0}
                  onClick={clearAll}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") clearAll(e as any);
                  }}
                  className="hover:bg-muted rounded p-0.5"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start" sideOffset={6}>
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-8 pl-8 text-sm"
              />
            </div>
          </div>

          <ScrollArea style={{ maxHeight }}>
            <div className="p-1" data-testid={id ? `${id}-list` : undefined}>
              {isLoading ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex flex-col items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Carregando…</span>
                </div>
              ) : error ? (
                <div
                  role="alert"
                  className="flex flex-col items-center justify-center gap-1.5 px-3 py-6 text-center text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Não foi possível carregar as opções.</span>
                  <span className="text-xs text-muted-foreground">
                    {typeof error === "string" ? error : error.message}
                  </span>
                </div>
              ) : options.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {emptyOptionsText}
                </p>
              ) : filteredOptions.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
              ) : (
                filteredOptions.map((opt) => {
                  const checked = value.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left",
                        "hover:bg-accent hover:text-accent-foreground",
                        checked && "bg-accent/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          checked
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-input",
                        )}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1 truncate">{opt.label}</span>
                      {typeof opt.count === "number" && (
                        <span className="text-xs text-muted-foreground">{opt.count}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="p-2 border-t flex items-center justify-between gap-2 bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange([])}
              disabled={value.length === 0}
            >
              Limpar
            </Button>
            <div className="flex items-center gap-2">
              {filteredOptions.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={selectAllVisible}
                >
                  Selecionar todos
                </Button>
              )}
              <Button size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
                Aplicar ({value.length})
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Renders a row of removable pills for currently selected values.
 * Optional helper for showing active selection outside the popover.
 */
export function MultiSelectPills({
  value,
  onChange,
  options,
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: MultiSelectOption[];
  className?: string;
}) {
  if (value.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {value.map((v) => {
        const opt = options.find((o) => o.value === v);
        return (
          <Badge key={v} variant="secondary" className="gap-1">
            {opt?.label ?? v}
            <X
              className="h-3 w-3 cursor-pointer"
              onClick={() => onChange(value.filter((x) => x !== v))}
            />
          </Badge>
        );
      })}
    </div>
  );
}
