import { ArrowLeft, Monitor, Smartphone, Undo2, Redo2, Save, Globe, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Link } from 'react-router-dom';
import type { BuilderState, BuilderAction } from '@/hooks/useSiteBuilderProState';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  onSave: () => void;
  onPublish: () => void;
  isSaving: boolean;
  isPublishing: boolean;
}

export function Topbar({ state, dispatch, onSave, onPublish, isSaving, isPublishing }: Props) {
  return (
    <div className="h-14 border-b bg-background flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <Link to="/site" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /></Link>
        <span className="font-semibold text-sm">Editor Avançado</span>
        {state.activePageId && (() => {
          const page = (state.present.pages || []).find(p => p.id === state.activePageId);
          return page ? (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              Página: {page.title}
            </span>
          ) : null;
        })()}
      </div>

      <div className="flex items-center gap-2">
        <ToggleGroup type="single" value={state.viewport} onValueChange={(v) => v && dispatch({ type: 'SET_VIEWPORT', viewport: v as any })} className="bg-muted rounded-md p-0.5">
          <ToggleGroupItem value="desktop" size="sm" className="px-2 h-7 text-xs gap-1"><Monitor className="w-3.5 h-3.5" /> Desktop</ToggleGroupItem>
          <ToggleGroupItem value="mobile" size="sm" className="px-2 h-7 text-xs gap-1"><Smartphone className="w-3.5 h-3.5" /> Mobile</ToggleGroupItem>
        </ToggleGroup>

        <Button
          variant="ghost" size="icon" className={cn("h-8 w-8", state.snapEnabled && "bg-primary/10 text-primary")}
          onClick={() => dispatch({ type: 'TOGGLE_SNAP' })}
          title={`Snap to grid (${state.gridSize}px) — ${state.snapEnabled ? 'ON' : 'OFF'}`}
        >
          <Grid3X3 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={state.past.length === 0} onClick={() => dispatch({ type: 'UNDO' })} title="Desfazer (Ctrl+Z)">
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={state.future.length === 0} onClick={() => dispatch({ type: 'REDO' })} title="Refazer (Ctrl+Shift+Z)">
          <Redo2 className="w-4 h-4" />
        </Button>
        {state.lastSavedAt && <span className="text-xs text-muted-foreground hidden sm:inline">Salvo às {format(state.lastSavedAt, 'HH:mm')}</span>}
        <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving || !state.isDirty} className="gap-1.5">
          <Save className="w-3.5 h-3.5" />{isSaving ? 'Salvando...' : 'Salvar rascunho'}
        </Button>
        <Button size="sm" onClick={onPublish} disabled={isPublishing} className="gap-1.5">
          <Globe className="w-3.5 h-3.5" />{isPublishing ? 'Publicando...' : 'Publicar'}
        </Button>
      </div>
    </div>
  );
}
