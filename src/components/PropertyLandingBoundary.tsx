import { Suspense, type ReactNode } from "react";
import { Loader2, AlertTriangle, Home } from "lucide-react";
import * as Sentry from "@sentry/react";
import { ChunkLoadErrorBoundary } from "@/components/ChunkLoadErrorBoundary";
import { Button } from "@/components/ui/button";

/**
 * Boundary dedicado ao lazy load do PropertyLandingPage.
 *
 * Camadas (de fora para dentro):
 * 1. Sentry.ErrorBoundary com fallback amigável — captura QUALQUER erro de runtime
 *    do lazy chunk ou do componente (ex.: `Loading chunk failed`, exceções não
 *    tratadas), evitando que a árvore Suspense fique presa em loading eterno.
 * 2. ChunkLoadErrorBoundary — trata especificamente erros de chunk (stale build),
 *    disparando reload controlado ou mostrando "Nova versão disponível".
 * 3. Suspense — fallback de carregamento enquanto o chunk não chega.
 */
export function PropertyLandingBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-2xl font-semibold text-foreground">
              Não foi possível carregar este imóvel
            </h2>
            <p className="text-sm text-muted-foreground">
              Houve um problema ao abrir a página. Tente novamente em instantes.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => resetError()}>
                Tentar novamente
              </Button>
              <Button onClick={() => (window.location.href = "/")}>
                <Home className="h-4 w-4 mr-2" />
                Página inicial
              </Button>
            </div>
          </div>
        </div>
      )}
      beforeCapture={(scope) => {
        scope.setTag("boundary", "PropertyLandingBoundary");
      }}
    >
      <ChunkLoadErrorBoundary>
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }
        >
          {children}
        </Suspense>
      </ChunkLoadErrorBoundary>
    </Sentry.ErrorBoundary>
  );
}
