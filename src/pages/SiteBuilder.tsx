import { useEffect, useCallback, useMemo } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteDocument, useSaveDraft, usePublishSite } from '@/hooks/useSiteDocument';
import { useSiteBuilderState, DEFAULT_SEED_LAYOUT } from '@/hooks/useSiteBuilderState';
import { BuilderTopbar } from '@/components/siteBuilder/BuilderTopbar';
import { BuilderSidebar } from '@/components/siteBuilder/BuilderSidebar';
import { BuilderPreview } from '@/components/siteBuilder/BuilderPreview';
import { BuilderInspector } from '@/components/siteBuilder/BuilderInspector';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function SiteBuilder() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const { data: doc, isLoading } = useSiteDocument(orgId);
  const saveDraft = useSaveDraft();
  const publishSite = usePublishSite();

  // Determine initial layout once doc loads
  const initialLayout = useMemo(() => {
    if (!doc) return undefined;
    const draft = doc.draft;
    return draft && draft.blocks && draft.blocks.length > 0 ? draft : DEFAULT_SEED_LAYOUT;
  }, [doc]);

  const { state, dispatch, canUndo, canRedo } = useSiteBuilderState(initialLayout);

  // When doc loads, set layout
  useEffect(() => {
    if (initialLayout) {
      dispatch({ type: 'SET_LAYOUT', layout: initialLayout });
    }
  }, [initialLayout]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave with 2s debounce
  useEffect(() => {
    if (!state.isDirty || !doc?.id) return;
    const timer = setTimeout(() => {
      saveDraft.mutate(
        { id: doc.id, draft: state.present },
        {
          onSuccess: () => dispatch({ type: 'MARK_SAVED', at: new Date() }),
          onError: () => toast.error('Erro ao salvar rascunho'),
        }
      );
    }, 2000);
    return () => clearTimeout(timer);
  }, [state.isDirty, state.present]); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual save
  const handleSave = useCallback(() => {
    if (!doc?.id) return;
    saveDraft.mutate(
      { id: doc.id, draft: state.present },
      {
        onSuccess: () => {
          dispatch({ type: 'MARK_SAVED', at: new Date() });
          toast.success('Rascunho salvo');
        },
        onError: () => toast.error('Erro ao salvar'),
      }
    );
  }, [doc?.id, state.present, saveDraft, dispatch]);

  // Publish
  const handlePublish = useCallback(() => {
    if (!doc?.id) return;
    publishSite.mutate(
      { id: doc.id, draft: state.present },
      {
        onSuccess: () => {
          dispatch({ type: 'MARK_SAVED', at: new Date() });
          toast.success('Site publicado com sucesso!');
        },
        onError: () => toast.error('Erro ao publicar'),
      }
    );
  }, [doc?.id, state.present, publishSite, dispatch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); }
      if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); dispatch({ type: 'REDO' }); }
      if (e.key === 'Delete' && state.selectedBlockId) {
        if (window.confirm('Excluir bloco selecionado?')) {
          dispatch({ type: 'DELETE_BLOCK', id: state.selectedBlockId });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dispatch, state.selectedBlockId]);

  // Has unpublished changes
  const hasUnpublishedChanges = useMemo(() => {
    if (!doc?.published) return true;
    return JSON.stringify(state.present) !== JSON.stringify(doc.published);
  }, [state.present, doc?.published]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <BuilderTopbar
        state={state}
        dispatch={dispatch}
        canUndo={canUndo}
        canRedo={canRedo}
        onSave={handleSave}
        onPublish={handlePublish}
        isSaving={saveDraft.isPending}
        isPublishing={publishSite.isPending}
        hasUnpublishedChanges={hasUnpublishedChanges}
        orgName={profile?.full_name || undefined}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <BuilderSidebar
            blocks={state.present.blocks}
            selectedBlockId={state.selectedBlockId}
            dispatch={dispatch}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={55}>
          <BuilderPreview
            blocks={state.present.blocks}
            theme={state.present.theme}
            selectedBlockId={state.selectedBlockId}
            viewport={state.viewport}
            dispatch={dispatch}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <BuilderInspector
            blocks={state.present.blocks}
            selectedBlockId={state.selectedBlockId}
            theme={state.present.theme}
            meta={state.present.meta}
            dispatch={dispatch}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
