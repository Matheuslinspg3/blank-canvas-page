import { useEffect, useCallback, useRef } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Topbar } from '@/components/siteBuilderPro/Topbar';
import { SidebarLeft } from '@/components/siteBuilderPro/SidebarLeft';
import { Canvas } from '@/components/siteBuilderPro/Canvas';
import { InspectorRight } from '@/components/siteBuilderPro/InspectorRight';
import { useSiteBuilderProState, buildSeedLayout } from '@/hooks/useSiteBuilderProState';
import { useSiteDocument, useSaveDraftV2, usePublishSiteV2 } from '@/hooks/useSiteDocument';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Import element & template registrations
import '@/components/siteBuilder/v2/elements';
import '@/components/siteBuilder/v2/sectionTemplates';

export default function SiteBuilderPro() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const { data: doc, isLoading } = useSiteDocument(orgId);
  const saveDraft = useSaveDraftV2();
  const publishSite = usePublishSiteV2();
  const { state, dispatch } = useSiteBuilderProState();
  const loaded = useRef(false);

  // Load layout from DB
  useEffect(() => {
    if (!doc || loaded.current) return;
    loaded.current = true;
    if (doc.draft_v2) {
      dispatch({ type: 'LOAD_LAYOUT', layout: doc.draft_v2 });
    } else {
      const seed = buildSeedLayout(state.present.theme);
      dispatch({ type: 'LOAD_LAYOUT', layout: seed });
    }
  }, [doc]);

  // Autosave debounced
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!doc || !state.isDirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft.mutate(
        { id: doc.id, draft_v2: state.present },
        { onSuccess: () => dispatch({ type: 'MARK_SAVED', at: new Date() }) },
      );
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [state.present, state.isDirty, doc]);

  // Manual save
  const handleSave = useCallback(() => {
    if (!doc) return;
    saveDraft.mutate(
      { id: doc.id, draft_v2: state.present },
      {
        onSuccess: () => {
          dispatch({ type: 'MARK_SAVED', at: new Date() });
          toast.success('Rascunho salvo');
        },
        onError: () => toast.error('Erro ao salvar'),
      },
    );
  }, [doc, state.present]);

  // Publish
  const handlePublish = useCallback(() => {
    if (!doc) return;
    publishSite.mutate(
      { id: doc.id, draft_v2: state.present },
      {
        onSuccess: () => toast.success('Site publicado!'),
        onError: () => toast.error('Erro ao publicar'),
      },
    );
  }, [doc, state.present]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); }
      if (isMod && e.key === 'z' && e.shiftKey) { e.preventDefault(); dispatch({ type: 'REDO' }); }
      if (e.key === 'Escape') dispatch({ type: 'SELECT', selection: { type: 'none' } });
      if (e.key === 'Delete' && state.selection.type === 'element') {
        dispatch({ type: 'DELETE_ELEMENT', sectionId: state.selection.sectionId, rowId: state.selection.rowId, columnId: state.selection.columnId, elementId: state.selection.elementId });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.selection]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Topbar state={state} dispatch={dispatch} onSave={handleSave} onPublish={handlePublish} isSaving={saveDraft.isPending} isPublishing={publishSite.isPending} />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <SidebarLeft state={state} dispatch={dispatch} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={55}>
          <Canvas state={state} dispatch={dispatch} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
          <InspectorRight state={state} dispatch={dispatch} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
