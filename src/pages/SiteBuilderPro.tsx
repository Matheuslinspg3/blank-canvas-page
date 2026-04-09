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

import '@/components/siteBuilder/v2/elements';
import '@/components/siteBuilder/v2/sectionTemplates';

export default function SiteBuilderPro() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const { data: doc, isLoading, isFetching } = useSiteDocument(orgId);
  const saveDraft = useSaveDraftV2();
  const publishSite = usePublishSiteV2();
  const { state, dispatch } = useSiteBuilderProState();
  const loaded = useRef(false);

  useEffect(() => {
    if (!doc || loaded.current || isFetching) return;
    loaded.current = true;
    if (doc.draft_v2) {
      dispatch({ type: 'LOAD_LAYOUT', layout: doc.draft_v2 });
    } else {
      dispatch({ type: 'LOAD_LAYOUT', layout: buildSeedLayout(state.present.theme) });
    }
  }, [doc, isFetching, dispatch, state.present.theme]);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!doc || !state.isDirty) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDraft.mutate({ id: doc.id, draft_v2: state.present }, { onSuccess: () => dispatch({ type: 'MARK_SAVED', at: new Date() }) });
    }, 2000);
    return () => clearTimeout(saveTimer.current);
  }, [state.present, state.isDirty, doc]);

  const handleSave = useCallback(() => {
    if (!doc) return;
    saveDraft.mutate({ id: doc.id, draft_v2: state.present }, {
      onSuccess: () => { dispatch({ type: 'MARK_SAVED', at: new Date() }); toast.success('Rascunho salvo'); },
      onError: () => toast.error('Erro ao salvar'),
    });
  }, [doc, state.present]);

  const handlePublish = useCallback(() => {
    if (!doc) return;
    publishSite.mutate({ id: doc.id, draft_v2: state.present }, {
      onSuccess: () => toast.success('Site publicado!'),
      onError: () => toast.error('Erro ao publicar'),
    });
  }, [doc, state.present]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch({ type: 'UNDO' }); }
      if (isMod && e.key === 'z' && e.shiftKey) { e.preventDefault(); dispatch({ type: 'REDO' }); }
      if (isMod && e.key === 'd') { e.preventDefault(); if (state.selection.type === 'element') dispatch({ type: 'DUPLICATE_ELEMENT', sectionId: state.selection.sectionId, rowId: state.selection.rowId, columnId: state.selection.columnId, elementId: state.selection.elementId }); }
      if (isMod && e.key === ']') { e.preventDefault(); if (state.selection.type === 'element') dispatch({ type: 'UPDATE_ELEMENT_LAYOUT', sectionId: state.selection.sectionId, rowId: state.selection.rowId, columnId: state.selection.columnId, elementId: state.selection.elementId, layout: { zIndex: 99 } }); }
      if (isMod && e.key === '[') { e.preventDefault(); if (state.selection.type === 'element') dispatch({ type: 'UPDATE_ELEMENT_LAYOUT', sectionId: state.selection.sectionId, rowId: state.selection.rowId, columnId: state.selection.columnId, elementId: state.selection.elementId, layout: { zIndex: 0 } }); }
      if (e.key === 'Escape') dispatch({ type: 'SELECT', selection: { type: 'none' } });
      if (e.key === 'Delete' && state.selection.type === 'element') {
        dispatch({ type: 'DELETE_ELEMENT', sectionId: state.selection.sectionId, rowId: state.selection.rowId, columnId: state.selection.columnId, elementId: state.selection.elementId });
      }
      // Arrow keys for absolute positioning
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && state.selection.type === 'element' && !isMod) {
        e.preventDefault();
        const step = e.shiftKey ? (state.snapEnabled ? state.gridSize : 8) : 1;
        const sel = state.selection;
        const deltaMap: Record<string, Partial<{ x: number; y: number }>> = {
          ArrowUp: { y: -step }, ArrowDown: { y: step }, ArrowLeft: { x: -step }, ArrowRight: { x: step },
        };
        const delta = deltaMap[e.key];
        if (delta) {
          // Find element to get current layout
          for (const s of state.present.sections) {
            if (s.id !== sel.sectionId) continue;
            for (const r of s.rows) {
              if (r.id !== sel.rowId) continue;
              for (const c of r.columns) {
                if (c.id !== sel.columnId) continue;
                if (c.layoutMode !== 'absolute') return;
                const el = c.elements.find(e2 => e2.id === sel.elementId);
                if (!el?.layout) return;
                const newLayout: any = {};
                if (delta.x !== undefined) newLayout.x = Math.max(0, (el.layout.x ?? 0) + delta.x);
                if (delta.y !== undefined) newLayout.y = Math.max(0, (el.layout.y ?? 0) + delta.y);
                dispatch({ type: 'UPDATE_ELEMENT_LAYOUT', sectionId: sel.sectionId, rowId: sel.rowId, columnId: sel.columnId, elementId: sel.elementId, layout: newLayout });
              }
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.selection, state.present, state.snapEnabled, state.gridSize]);

  if (isLoading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
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
