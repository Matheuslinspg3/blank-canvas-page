import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Home, FileText, GripVertical, ExternalLink, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BuilderState, BuilderAction } from '@/hooks/useSiteBuilderProState';
import type { NavItem } from '@/types/siteBuilderV2';

interface Props {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
}

export function PagesTab({ state, dispatch }: Props) {
  const { present, activePageId } = state;
  const pages = present.pages || [];
  const navigation = present.navigation || [];
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');

  const handleAddPage = () => {
    if (!newTitle.trim() || !newSlug.trim()) return;
    const slug = newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-|-$/g, '');
    if (!slug) return;
    dispatch({ type: 'ADD_PAGE', slug, title: newTitle.trim() });
    // Auto-add to navigation
    const nav: NavItem[] = [...navigation, { label: newTitle.trim(), href: `/${slug}`, type: 'page' }];
    dispatch({ type: 'UPDATE_NAVIGATION', navigation: nav });
    setNewTitle('');
    setNewSlug('');
    setAdding(false);
  };

  const handleDeletePage = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    dispatch({ type: 'DELETE_PAGE', pageId });
    if (page) {
      const nav = navigation.filter(n => n.href !== `/${page.slug}`);
      dispatch({ type: 'UPDATE_NAVIGATION', navigation: nav });
    }
  };

  const ensureDefaultNav = () => {
    if (navigation.length > 0) return;
    const defaultNav: NavItem[] = [
      { label: 'Home', href: '/', type: 'page' },
      { label: 'Imóveis', href: '/imoveis', type: 'page' },
    ];
    dispatch({ type: 'UPDATE_NAVIGATION', navigation: defaultNav });
  };

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {/* Homepage */}
          <div
            onClick={() => dispatch({ type: 'SET_ACTIVE_PAGE', pageId: null })}
            className={cn(
              'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs cursor-pointer transition-colors border',
              activePageId === null
                ? 'bg-primary/10 border-primary/30 font-medium'
                : 'hover:bg-accent/50 border-transparent'
            )}
          >
            <Home className="w-4 h-4 text-primary shrink-0" />
            <span className="flex-1">Home</span>
            <span className="text-muted-foreground text-[10px]">/</span>
          </div>

          {/* Built-in /imoveis */}
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs border border-dashed border-muted-foreground/30 text-muted-foreground">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="flex-1">Imóveis</span>
            <span className="text-[10px]">/imoveis</span>
            <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded">auto</span>
          </div>

          {/* Custom pages */}
          {pages.filter(p => p.slug !== 'imoveis').map(page => (
            <div
              key={page.id}
              onClick={() => dispatch({ type: 'SET_ACTIVE_PAGE', pageId: page.id })}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs cursor-pointer transition-colors border',
                activePageId === page.id
                  ? 'bg-primary/10 border-primary/30 font-medium'
                  : 'hover:bg-accent/50 border-transparent'
              )}
            >
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate">{page.title}</span>
              <span className="text-muted-foreground text-[10px]">/{page.slug}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id); }}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Add page form */}
          {adding ? (
            <div className="space-y-2 p-2 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <Label className="text-[10px]">Título</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => {
                    setNewTitle(e.target.value);
                    setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                  }}
                  placeholder="Ex: Sobre Nós"
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Slug (URL)</Label>
                <Input
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                  placeholder="sobre"
                  className="h-7 text-xs"
                />
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={handleAddPage}>Criar</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>Cancelar</Button>
              </div>
            </div>
          ) : null}

          {/* Navigation preview */}
          {navigation.length > 0 && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-1.5 mb-2">
                <Navigation className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Menu</span>
              </div>
              <div className="space-y-0.5">
                {navigation.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1 text-[11px] text-muted-foreground">
                    {item.type === 'external' && <ExternalLink className="w-3 h-3" />}
                    <span className="flex-1 truncate">{item.label}</span>
                    <span className="text-[10px]">{item.href}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-2 border-t space-y-1">
        <Button className="w-full gap-1.5" size="sm" onClick={() => { ensureDefaultNav(); setAdding(true); }}>
          <Plus className="w-4 h-4" /> Nova Página
        </Button>
      </div>
    </div>
  );
}
