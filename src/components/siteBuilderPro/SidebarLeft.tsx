import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Layers, LayoutGrid, Plus, Trash2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { ElementRegistry } from '@/components/siteBuilder/v2/elementRegistry';
import type { BuilderState, BuilderAction, Selection } from '@/hooks/useSiteBuilderProState';
import { cn } from '@/lib/utils';
import { AddSectionSheet } from './AddSectionSheet';

interface Props {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
}

export function SidebarLeft({ state, dispatch }: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { present, selection } = state;
  const sections = [...present.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="h-full flex flex-col bg-background border-r">
      <Tabs defaultValue="pages" className="flex-1 flex flex-col">
        <TabsList className="w-full rounded-none border-b h-10 bg-transparent justify-start px-1">
          <TabsTrigger value="pages" className="text-xs gap-1"><LayoutGrid className="w-3.5 h-3.5" /> Seções</TabsTrigger>
          <TabsTrigger value="layers" className="text-xs gap-1"><Layers className="w-3.5 h-3.5" /> Camadas</TabsTrigger>
          <TabsTrigger value="elements" className="text-xs gap-1"><Plus className="w-3.5 h-3.5" /> Elementos</TabsTrigger>
        </TabsList>

        {/* Tab: Seções */}
        <TabsContent value="pages" className="flex-1 m-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {sections.map(s => {
                const isSelected = selection.type === 'section' && selection.sectionId === s.id;
                const elCount = s.rows.reduce((acc, r) => acc + r.columns.reduce((a2, c) => a2 + c.elements.length, 0), 0);
                return (
                  <div
                    key={s.id}
                    onClick={() => dispatch({ type: 'SELECT', selection: { type: 'section', sectionId: s.id } })}
                    className={cn(
                      'flex items-center gap-2 px-2 py-2 rounded-md text-xs cursor-pointer hover:bg-accent/50 transition-colors',
                      isSelected && 'bg-primary/10 border border-primary/30',
                    )}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0 cursor-grab" />
                    <span className="flex-1 truncate font-medium">{s.name || 'Seção sem nome'}</span>
                    <span className="text-muted-foreground text-[10px]">{elCount} el.</span>
                    <Switch
                      checked={s.visible}
                      onCheckedChange={(e) => {
                        e && dispatch({ type: 'TOGGLE_SECTION_VISIBILITY', sectionId: s.id });
                        !e && dispatch({ type: 'TOGGLE_SECTION_VISIBILITY', sectionId: s.id });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="scale-75"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_SECTION', sectionId: s.id }); }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="p-2 border-t">
            <Button className="w-full gap-1.5" size="sm" onClick={() => setSheetOpen(true)}>
              <Plus className="w-4 h-4" /> Adicionar Seção
            </Button>
          </div>
          <AddSectionSheet open={sheetOpen} onOpenChange={setSheetOpen} dispatch={dispatch} />
        </TabsContent>

        {/* Tab: Camadas */}
        <TabsContent value="layers" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-1">
              {sections.map(s => (
                <SectionLayerTree key={s.id} section={s} selection={selection} dispatch={dispatch} />
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tab: Elementos */}
        <TabsContent value="elements" className="flex-1 m-0">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-3">
              <p className="text-[10px] text-muted-foreground">Selecione uma coluna e clique para adicionar</p>
              <ElementPalette state={state} dispatch={dispatch} />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Layer tree ────────────────────────────────────────────────
function SectionLayerTree({ section, selection, dispatch }: { section: any; selection: Selection; dispatch: React.Dispatch<BuilderAction> }) {
  const [open, setOpen] = useState(true);
  const isSelected = selection.type === 'section' && selection.sectionId === section.id;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn('flex items-center gap-1 px-1 py-1 rounded text-xs cursor-pointer hover:bg-accent/50', isSelected && 'bg-primary/10')}
          onClick={() => dispatch({ type: 'SELECT', selection: { type: 'section', sectionId: section.id } })}
        >
          {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span className="truncate font-medium">{section.name || 'Seção'}</span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-3">
        {section.rows.map((row: any) => (
          <div key={row.id} className="pl-2 border-l border-muted">
            <p className="text-[10px] text-muted-foreground py-0.5">Linha</p>
            {row.columns.map((col: any) => (
              <div key={col.id} className="pl-2 border-l border-muted">
                <div
                  className={cn(
                    'text-[10px] py-0.5 cursor-pointer hover:text-primary',
                    selection.type === 'column' && selection.columnId === col.id && 'text-primary font-medium',
                  )}
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', selection: { type: 'column', sectionId: section.id, rowId: row.id, columnId: col.id } }); }}
                >
                  Coluna ({col.width}/12)
                </div>
                {col.elements.map((el: any) => {
                  const def = ElementRegistry[el.type as keyof typeof ElementRegistry];
                  return (
                    <div
                      key={el.id}
                      className={cn(
                        'pl-2 text-[10px] py-0.5 cursor-pointer hover:text-primary truncate',
                        selection.type === 'element' && selection.elementId === el.id && 'text-primary font-medium',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({ type: 'SELECT', selection: { type: 'element', sectionId: section.id, rowId: row.id, columnId: col.id, elementId: el.id } });
                      }}
                    >
                      {def?.label || el.type}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Element palette ──────────────────────────────────────────
function ElementPalette({ state, dispatch }: { state: BuilderState; dispatch: React.Dispatch<BuilderAction> }) {
  const defs = Object.values(ElementRegistry).filter(Boolean) as any[];
  const categories = [...new Set(defs.map(d => d.category))];
  const LABELS: Record<string, string> = { basic: 'Básicos', media: 'Mídia', properties: 'Imóveis', content: 'Conteúdo', advanced: 'Avançados' };

  const handleAdd = (elementType: string) => {
    const sel = state.selection;
    if (sel.type === 'column') {
      dispatch({ type: 'ADD_ELEMENT', sectionId: sel.sectionId, rowId: sel.rowId, columnId: sel.columnId, elementType: elementType as any });
    } else if (sel.type === 'element') {
      dispatch({ type: 'ADD_ELEMENT', sectionId: sel.sectionId, rowId: sel.rowId, columnId: sel.columnId, elementType: elementType as any });
    } else {
      // Add to last column of last row of first section
      const sections = state.present.sections;
      if (sections.length > 0) {
        const s = sections[0];
        if (s.rows.length > 0) {
          const r = s.rows[s.rows.length - 1];
          if (r.columns.length > 0) {
            const c = r.columns[0];
            dispatch({ type: 'ADD_ELEMENT', sectionId: s.id, rowId: r.id, columnId: c.id, elementType: elementType as any });
          }
        }
      }
    }
  };

  return (
    <>
      {categories.map(cat => (
        <div key={cat}>
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{LABELS[cat] || cat}</h4>
          <div className="grid grid-cols-2 gap-1">
            {defs.filter(d => d.category === cat).map(d => {
              const Icon = d.icon;
              return (
                <button
                  key={d.type}
                  onClick={() => handleAdd(d.type)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs hover:border-primary hover:bg-accent/50 transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{d.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
