import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6 bg-background text-foreground">
          <AlertTriangle className="h-16 w-16 text-destructive" />
          <h1 className="text-2xl font-bold">Algo deu errado</h1>
          <p className="text-muted-foreground text-center max-w-md">
            Ocorreu um erro inesperado. Tente recarregar a página ou voltar ao dashboard.
          </p>
          {this.state.error && (
            <pre className="text-xs text-muted-foreground bg-muted rounded-md p-3 max-w-lg overflow-auto max-h-32">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Recarregar página
            </button>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              className="px-4 py-2 rounded-md border border-border text-foreground font-medium hover:bg-accent transition-colors"
            >
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
