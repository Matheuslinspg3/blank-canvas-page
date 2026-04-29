import { ReactNode } from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Padronização de filtros: SEMPRE renderiza algo no DOM.
 *
 * Os 4 estados explícitos são:
 *  - `isLoading`  → skeleton/spinner
 *  - `error`      → mensagem de erro (não esconde o campo)
 *  - `isEmpty`    → empty-state amigável (não esconde o campo)
 *  - default      → renderiza `children` normalmente
 *
 * Regra do projeto (guardrail): NUNCA fazer `data.length > 0 && <Filter />`.
 * Sempre use `<FilterField isEmpty={data.length === 0}>...</FilterField>` para
 * garantir que o usuário enxergue o porquê do campo estar vazio.
 */
export interface FilterFieldProps {
  /** Rótulo do campo. */
  label?: ReactNode;
  /** Indica se os dados de origem ainda estão carregando. */
  isLoading?: boolean;
  /** Erro retornado pela query, se houver. */
  error?: Error | string | null;
  /** Se true, mostra empty-state em vez do conteúdo. */
  isEmpty?: boolean;
  /** Mensagem de empty-state (default: "Nenhuma opção disponível"). */
  emptyMessage?: string;
  /** Conteúdo principal — geralmente um input/select/MultiSelectFilter. */
  children: ReactNode;
  className?: string;
  /** Para testes/aria. */
  id?: string;
}

export function FilterField({
  label,
  isLoading,
  error,
  isEmpty,
  emptyMessage = "Nenhuma opção disponível",
  children,
  className,
  id,
}: FilterFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)} data-testid={id}>
      {label && (
        <Label className="text-xs text-muted-foreground">{label}</Label>
      )}

      {isLoading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Carregando opções…</span>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-medium">Não foi possível carregar.</p>
            <p className="opacity-80">
              {typeof error === "string" ? error : error.message}
            </p>
          </div>
        </div>
      ) : (
        <>
          {children}
          {isEmpty && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground italic px-1">
              <Inbox className="h-3 w-3" />
              {emptyMessage}
            </p>
          )}
        </>
      )}
    </div>
  );
}
