import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SectionTemplateRegistry } from '@/components/siteBuilder/v2/sectionTemplates';
import type { BuilderAction } from '@/hooks/useSiteBuilderProState';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dispatch: React.Dispatch<BuilderAction>;
}

const CATEGORY_LABELS: Record<string, string> = {
  hero: '🏠 Hero',
  about: '📋 Sobre',
  properties: '🏗️ Imóveis',
  contact: '📞 Contato',
  cta: '📢 CTA',
  footer: '📌 Rodapé',
  custom: '✨ Personalizado',
};

export function AddSectionSheet({ open, onOpenChange, dispatch }: Props) {
  const categories = [...new Set(SectionTemplateRegistry.map(t => t.category))];

  const handleAdd = (templateId: string) => {
    dispatch({ type: 'ADD_SECTION', templateId });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:max-w-[400px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Adicionar Seção</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-6">
          {categories.map(cat => {
            const templates = SectionTemplateRegistry.filter(t => t.category === cat);
            if (templates.length === 0) return null;
            return (
              <div key={cat}>
                <h3 className="text-sm font-semibold mb-2">{CATEGORY_LABELS[cat] || cat}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleAdd(t.id)}
                      className="border rounded-lg p-3 text-left hover:border-primary hover:bg-accent/50 transition-colors"
                    >
                      <div className="w-full h-16 rounded bg-muted mb-2 flex items-center justify-center text-muted-foreground text-xs">
                        Preview
                      </div>
                      <p className="text-xs font-medium truncate">{t.label}</p>
                      {t.description && <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
