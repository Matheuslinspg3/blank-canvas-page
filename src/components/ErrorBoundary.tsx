import * as Sentry from "@sentry/react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { isImportChunkError } from "@/utils/chunkErrorDetection";
import { safeReloadOnce, hasReloadedThisSession } from "@/utils/safeReload";

function FallbackUI({ error, resetError }: { error: Error; resetError: () => void }) {
  const [reloading, setReloading] = useState(false);
  const isChunk = isImportChunkError(error);
  const offline = !navigator.onLine;

  const title = isChunk ? "Nova versão disponível" : "Algo deu errado";
  const message = isChunk
    ? offline
      ? "Você está offline. Verifique sua conexão e tente novamente."
      : "Atualizamos o aplicativo. Recarregue para usar a versão mais recente."
    : "Ocorreu um erro inesperado. Tente novamente ou volte ao dashboard.";

  const handleReload = () => {
    setReloading(true);
    try {
      sessionStorage.removeItem("lov_reload_attempted_v1");
    } catch {
      /* no-op */
    }
    window.location.reload();
  };

  // For chunk errors, attempt one auto-reload (guarded). Render placeholder while it kicks in.
  if (isChunk && !hasReloadedThisSession() && !offline) {
    safeReloadOnce("ErrorBoundary:auto");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6 bg-background text-foreground">
      {isChunk ? (
        <RefreshCw className="h-16 w-16 text-primary" />
      ) : (
        <AlertTriangle className="h-16 w-16 text-destructive" />
      )}
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground text-center max-w-md">{message}</p>
      {!isChunk && error?.message && (
        <pre className="text-xs text-muted-foreground bg-muted rounded-md p-3 max-w-lg overflow-auto max-h-32">
          {error.message}
        </pre>
      )}
      <div className="flex gap-3 flex-wrap justify-center">
        {!isChunk && (
          <button
            onClick={resetError}
            className="px-4 py-2 rounded-md border border-border text-foreground font-medium hover:bg-accent transition-colors"
          >
            Tentar novamente
          </button>
        )}
        <button
          onClick={handleReload}
          disabled={reloading}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {reloading ? "Recarregando..." : "Recarregar página"}
        </button>
        {!isChunk && (
          <button
            onClick={() => (window.location.href = "/dashboard")}
            className="px-4 py-2 rounded-md border border-border text-foreground font-medium hover:bg-accent transition-colors"
          >
            Voltar ao Dashboard
          </button>
        )}
      </div>
    </div>
  );
}

export function ErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <FallbackUI error={error as Error} resetError={resetError} />
      )}
      beforeCapture={(scope, error) => {
        scope.setTag("chunk_error", isImportChunkError(error) ? "true" : "false");
        scope.setTag("route", window.location.pathname);
        scope.setContext("runtime", {
          online: navigator.onLine,
          visibility: document.visibilityState,
          connection: (navigator as any).connection?.effectiveType ?? "unknown",
          sw_controller: !!navigator.serviceWorker?.controller,
        });
      }}
      showDialog={false}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
