import {
  Undo2,
  Redo2,
  Save,
  Globe,
  Monitor,
  Smartphone,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { SiteBuilderAction, SiteBuilderState } from '@/hooks/useSiteBuilderState';
import { useNavigate } from 'react-router-dom';

interface Props {
  state: SiteBuilderState;
  dispatch: React.Dispatch<SiteBuilderAction>;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onPublish: () => void;
  isSaving: boolean;
  isPublishing: boolean;
  hasUnpublishedChanges: boolean;
  orgName?: string;
}

export function BuilderTopbar({
  state,
  dispatch,
  canUndo,
  canRedo,
  onSave,
  onPublish,
  isSaving,
  isPublishing,
  hasUnpublishedChanges,
  orgName,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="h-14 border-b bg-background flex items-center px-4 gap-4 flex-shrink-0">
      {/* Left */}
      <Button variant="ghost" size="icon" onClick={() => navigate('/site')} className="mr-1">
        <ArrowLeft className="w-4 h-4" />
      </Button>
      <div className="flex items-center gap-2 mr-auto">
        <Globe className="w-4 h-4 text-primary" />
        <span className="font-semibold text-sm hidden sm:inline">Editor de Site</span>
        {orgName && <span className="text-xs text-muted-foreground hidden md:inline">— {orgName}</span>}
      </div>

      {/* Center: viewport toggle */}
      <ToggleGroup
        type="single"
        value={state.viewport}
        onValueChange={(v) => v && dispatch({ type: 'SET_VIEWPORT', viewport: v as 'desktop' | 'mobile' })}
        className="border rounded-lg"
      >
        <ToggleGroupItem value="desktop" size="sm"><Monitor className="w-4 h-4" /></ToggleGroupItem>
        <ToggleGroupItem value="mobile" size="sm"><Smartphone className="w-4 h-4" /></ToggleGroupItem>
      </ToggleGroup>

      {/* Right */}
      <div className="flex items-center gap-2 ml-auto">
        <Button variant="ghost" size="icon" disabled={!canUndo} onClick={() => dispatch({ type: 'UNDO' })} title="Desfazer (Ctrl+Z)">
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" disabled={!canRedo} onClick={() => dispatch({ type: 'REDO' })} title="Refazer (Ctrl+Shift+Z)">
          <Redo2 className="w-4 h-4" />
        </Button>

        {state.lastSavedAt && (
          <span className="text-xs text-muted-foreground hidden lg:inline">
            Salvo às {format(state.lastSavedAt, 'HH:mm', { locale: ptBR })}
          </span>
        )}

        <Button variant="outline" size="sm" onClick={onSave} disabled={isSaving || !state.isDirty}>
          <Save className="w-4 h-4 mr-1" /> Salvar
        </Button>

        <div className="relative">
          <Button size="sm" onClick={onPublish} disabled={isPublishing}>
            Publicar
          </Button>
          {hasUnpublishedChanges && (
            <Badge variant="destructive" className="absolute -top-2 -right-2 text-[10px] px-1 py-0 leading-4">
              novo
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
