import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function QueryErrorState({ message = "Erro ao carregar dados", onRetry }: QueryErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 gap-4">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}
