import React from "react";
import * as Sentry from "@sentry/react";

interface Props {
  children: React.ReactNode;
  orgName?: string;
  whatsappNumber?: string | null;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Local error boundary for the white-label storefront. If the V2 renderer
 * crashes (corrupt layout JSON, broken element type, etc.), show a friendly
 * fallback with the agency's WhatsApp instead of a blank page.
 */
export class StorefrontErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    Sentry.captureException(error, {
      tags: { source: "storefront-renderer" },
      extra: { componentStack: info.componentStack, orgName: this.props.orgName },
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    const wa = (this.props.whatsappNumber || "").replace(/\D/g, "");
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {this.props.orgName || "Site temporariamente indisponível"}
          </h1>
          <p className="text-gray-600 mb-6">
            Estamos com uma instabilidade técnica. Fale conosco diretamente:
          </p>
          {wa && (
            <a
              href={`https://wa.me/${wa.length === 10 || wa.length === 11 ? `55${wa}` : wa}`}
              className="inline-block px-6 py-3 rounded-lg bg-green-600 text-white font-medium"
            >
              Falar pelo WhatsApp
            </a>
          )}
          <button
            onClick={() => window.location.reload()}
            className="block mx-auto mt-4 text-sm underline text-gray-500"
          >
            Recarregar a página
          </button>
        </div>
      </div>
    );
  }
}
