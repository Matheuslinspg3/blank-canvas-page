import { Component, type ErrorInfo, type ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { RefreshCw } from "lucide-react";
import { isImportChunkError } from "@/utils/chunkErrorDetection";
import { safeReloadOnce, hasReloadedThisSession } from "@/utils/safeReload";

interface Props {
  children: ReactNode;
  /** Optional fallback override for non-chunk errors. If omitted, re-throws to outer boundary. */
  fallback?: ReactNode;
}

interface State {
  chunkError: Error | null;
}

/**
 * Catches dynamic-import / stale-chunk errors and either:
 *  - silently reloads once (controlled, anti-loop), or
 *  - shows a friendly "new version available" UI if reload was already attempted.
 *
 * Non-chunk errors are re-thrown so an outer Sentry.ErrorBoundary handles them.
 */
export class ChunkLoadErrorBoundary extends Component<Props, State> {
  state: State = { chunkError: null };

  static getDerivedStateFromError(error: Error): State | null {
    if (isImportChunkError(error)) {
      return { chunkError: error };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (!isImportChunkError(error)) {
      // Let the outer boundary handle it.
      throw error;
    }
    Sentry.captureException(error, {
      tags: { chunk_error: "true", boundary: "ChunkLoadErrorBoundary" },
      extra: { componentStack: info.componentStack },
    });
    // Try a single controlled reload.
    safeReloadOnce("ChunkLoadErrorBoundary");
  }

  private handleManualReload = () => {
    // User-initiated reload — bypass the session guard.
    try {
      sessionStorage.removeItem("lov_reload_attempted_v1");
    } catch {
      /* no-op */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.chunkError) return this.props.children;

    // If safeReloadOnce already triggered a reload, this UI flashes briefly — that's fine.
    // If it was blocked (offline / already reloaded), show a friendly fallback.
    const blocked = hasReloadedThisSession() || !navigator.onLine;
    if (!blocked) {
      // Reload is in flight — render minimal placeholder.
      return (
        <div className="flex items-center justify-center min-h-[40vh] p-6">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <RefreshCw className="h-10 w-10 text-primary" />
        <h2 className="text-xl font-semibold text-foreground">Nova versão disponível</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {!navigator.onLine
            ? "Você está sem conexão. Verifique sua internet e tente novamente."
            : "Atualizamos o aplicativo. Recarregue para usar a versão mais recente."}
        </p>
        <button
          onClick={this.handleManualReload}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          Recarregar
        </button>
      </div>
    );
  }
}
