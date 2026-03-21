import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[SectionErrorBoundary${this.props.section ? `: ${this.props.section}` : ""}] Error:`, error);
    console.error("[SectionErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-lg border border-border bg-card text-card-foreground min-h-[200px]">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="text-sm font-medium">Erro ao carregar esta seção</p>
          {this.state.error && (
            <p className="text-xs text-muted-foreground max-w-md text-center truncate">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
