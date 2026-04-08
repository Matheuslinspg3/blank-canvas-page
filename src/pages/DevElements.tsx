import { Component, ReactNode } from 'react';
import '@/components/siteBuilder/v2/elements';
import { ElementRegistry, DEFAULT_STYLES } from '@/components/siteBuilder/v2/elementRegistry';
import type { Element, ElementType } from '@/types/siteBuilderV2';

// Per-card error boundary
class CardErrorBoundary extends Component<
  { type: string; children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 border border-destructive rounded-lg bg-destructive/10 text-destructive text-sm">
          ❌ {this.props.type}: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  basic: '🟢 Básicos',
  media: '🔵 Mídia / Contato',
  properties: '🟠 Imóveis',
  content: '🟣 Conteúdo',
  advanced: '🔴 Avançados',
};

const CATEGORY_ORDER = ['basic', 'media', 'properties', 'content', 'advanced'];

export default function DevElements() {
  const entries = Object.values(ElementRegistry).filter(Boolean);
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    elements: entries.filter((e) => e!.category === cat),
  }));

  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-2xl font-bold mb-2">Elementos v2 — Catálogo ({entries.length})</h1>
      <p className="text-sm text-muted-foreground mb-6">Todos os elementos renderizados com defaultProps + defaultStyles</p>
      {grouped.map(({ category, label, elements }) => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold mb-4">{label} ({elements.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {elements.map((def) => {
              if (!def) return null;
              const mockElement: Element = {
                id: `mock-${def.type}`,
                type: def.type,
                props: def.defaultProps,
                styles: def.defaultStyles || DEFAULT_STYLES,
              };
              const Icon = def.icon;
              return (
                <CardErrorBoundary key={def.type} type={def.type}>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 p-2 flex items-center gap-2 border-b">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{def.label}</span>
                      <code className="text-xs text-muted-foreground ml-auto">{def.type}</code>
                    </div>
                    <div className="p-3 bg-white min-h-[100px]">
                      <def.Component element={mockElement} isEditing />
                    </div>
                  </div>
                </CardErrorBoundary>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
