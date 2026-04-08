import { Component, ReactNode } from 'react';
import '@/components/siteBuilder/v2/elements';
import '@/components/siteBuilder/v2/sectionTemplates';
import { SectionTemplateRegistry } from '@/components/siteBuilder/v2/sectionTemplates';
import { SectionRenderer } from '@/components/siteBuilder/v2/SectionRenderer';
import type { SiteTheme } from '@/types/siteBuilder';

const DEMO_THEME: SiteTheme = {
  primaryColor: '#2563eb',
  secondaryColor: '#1e293b',
  accentColor: '#f59e0b',
  fontFamily: 'Inter, sans-serif',
};

class SectionErrorBoundary extends Component<
  { id: string; children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 border border-destructive rounded-lg bg-destructive/10 text-destructive m-4">
          ❌ {this.props.id}: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  hero: '🎯 Hero',
  about: '📝 Sobre',
  properties: '🏠 Imóveis',
  contact: '📞 Contato',
  cta: '🚀 CTA',
  footer: '🔻 Footer',
  custom: '⚙️ Custom',
};

const CATEGORY_ORDER = ['hero', 'about', 'properties', 'contact', 'cta', 'footer', 'custom'];

export default function DevSections() {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    templates: SectionTemplateRegistry.filter((t) => t.category === cat),
  })).filter((g) => g.templates.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-6 py-4 sticky top-0 z-50">
        <h1 className="text-xl font-bold">Section Templates — Preview ({SectionTemplateRegistry.length})</h1>
        <p className="text-sm text-muted-foreground">Cada seção renderizada com SectionRenderer + tema padrão</p>
      </header>

      {grouped.map(({ category, label, templates }) => (
        <div key={category}>
          <div className="bg-muted/50 border-b px-6 py-3">
            <h2 className="text-lg font-semibold">{label} ({templates.length})</h2>
          </div>
          {templates.map((tmpl) => {
            const builtSection = tmpl.build(DEMO_THEME);
            return (
              <SectionErrorBoundary key={tmpl.id} id={tmpl.id}>
                <div className="mb-1">
                  <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-sm font-mono">
                    <span className="font-bold">{tmpl.id}</span>
                    <span className="ml-3 text-muted-foreground">{tmpl.label}</span>
                  </div>
                  <SectionRenderer
                    section={builtSection}
                    theme={DEMO_THEME}
                    isEditing={false}
                  />
                </div>
              </SectionErrorBoundary>
            );
          })}
        </div>
      ))}
    </div>
  );
}
