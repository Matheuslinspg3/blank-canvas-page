import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface UnsavedChangesDialogProps {
  open: boolean;
  /** Título contextual, ex: "imóvel" ou "lead" */
  entityLabel?: string;
  isSaving?: boolean;
  /**
   * Quando true, indica que o registro já existe (edição). Nesse caso a ação
   * principal salva as alterações mantendo o status atual (não rebaixa para
   * rascunho). Quando false/undefined, trata-se de criação e a ação salva
   * explicitamente como rascunho.
   */
  isExisting?: boolean;
  onSaveDraft: () => void;
  onDiscard: () => void;
  onKeepEditing: () => void;
}

/**
 * Diálogo exibido ao tentar fechar um formulário com alterações não salvas.
 * Oferece três ações: salvar (como rascunho na criação / mantendo status na
 * edição), descartar ou continuar editando.
 */
export function UnsavedChangesDialog({
  open,
  entityLabel = 'registro',
  isSaving = false,
  isExisting = false,
  onSaveDraft,
  onDiscard,
  onKeepEditing,
}: UnsavedChangesDialogProps) {
  const saveLabel = isExisting ? 'Salvar alterações' : 'Salvar como rascunho';
  const description = isExisting
    ? `Você tem alterações não salvas neste ${entityLabel}. Deseja salvar as alterações ou descartar?`
    : `Você tem alterações não salvas neste ${entityLabel}. Deseja salvar como rascunho para continuar depois, ou descartar?`;
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onKeepEditing(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Salvar alterações?</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onKeepEditing}
            disabled={isSaving}
          >
            Continuar editando
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="destructive"
              onClick={onDiscard}
              disabled={isSaving}
            >
              Descartar
            </Button>
            <Button
              type="button"
              onClick={onSaveDraft}
              disabled={isSaving}
            >
              {isSaving ? 'Salvando…' : saveLabel}
            </Button>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
