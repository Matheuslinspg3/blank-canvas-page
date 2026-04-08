import { useEffect, useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Topbar } from '@/components/siteBuilderPro/Topbar';
import { SidebarLeft } from '@/components/siteBuilderPro/SidebarLeft';
import { Canvas } from '@/components/siteBuilderPro/Canvas';
import { InspectorRight } from '@/components/siteBuilderPro/InspectorRight';
import { useSiteBuilderProState, buildSeedLayout, type BuilderAction } from '@/hooks/useSiteBuilderProState';
import { DevQAPanel } from '@/components/siteBuilderPro/DevQAPanel';
import { toast } from 'sonner';

import '@/components/siteBuilder/v2/elements';
import '@/components/siteBuilder/v2/sectionTemplates';

const MOCK_THEME = {
  primaryColor: '#2563eb',
  secondaryColor: '#1e293b',
  accentColor: '#f59e0b',
  fontFamily: 'Inter',
};

const TRACKED_ACTIONS = new Set([
  'REORDER_SECTIONS',
  'MOVE_ELEMENT_BETWEEN_COLUMNS',
  'UPDATE_ELEMENT_LAYOUT',
  'UPDATE_COLUMN_LAYOUT_MODE',
  'UPDATE_COLUMN_WIDTH',
  'UPDATE_COLUMN_MIN_HEIGHT',
  'DELETE_ELEMENT',
  'DUPLICATE_ELEMENT',
  'UNDO',
  'REDO',
]);

interface EventEntry {
  time: string;
  action: string;
  payload: string;
}

export default function DevSiteBuilderPro() {
  const { state, dispatch: rawDispatch } = useSiteBuilderProState();
  const loaded = useRef(false);
  const [eventLog, setEventLog] = useState<EventEntry[]>([]);
  const [externalGuides, setExternalGuides] = useState<{ x?: number; y?: number }[]>([]);

  // Wrap dispatch to log tracked actions
  const dispatch = useCallback((action: BuilderAction) => {
    if (TRACKED_ACTIONS.has(action.type)) {
      const { type, ...rest } = action;
      setEventLog(prev => [{
        time: new Date().toLocaleTimeString('pt-BR'),
        action: type,
        payload: JSON.stringify(rest).slice(0, 120),
      }, ...prev].slice(0, 50));
    }
    rawDispatch(action);
  }, [rawDispatch]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const seed = buildSeedLayout(MOCK_THEME);
    dispatch({ type: 'LOAD_LAYOUT', layout: seed });
  }, []);

  const handleSave = useCallback(() => {
    toast.success('Mock save — rascunho salvo (dev mode)');
    dispatch({ type: 'MARK_SAVED', at: new Date() });
  }, [dispatch]);

  const handlePublish = useCallback(() => {
    toast.success('Mock publish — site publicado (dev mode)');
  }, []);

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
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && state.selection.type === 'element' && !isMod) {
        e.preventDefault();
        const step = e.shiftKey ? (state.snapEnabled ? state.gridSize : 8) : 1;
        const sel = state.selection;
        const deltaMap: Record<string, Partial<{ x: number; y: number }>> = {
          ArrowUp: { y: -step }, ArrowDown: { y: step }, ArrowLeft: { x: -step }, ArrowRight: { x: step },
        };
        const delta = deltaMap[e.key];
        if (delta) {
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

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="bg-amber-500 text-amber-950 text-center text-xs py-1 font-semibold">
        🔧 DEV MODE — Editor Avançado (sem auth, dados mock)
      </div>
      <Topbar state={state} dispatch={dispatch} onSave={handleSave} onPublish={handlePublish} isSaving={false} isPublishing={false} />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
          <SidebarLeft state={state} dispatch={dispatch} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={55}>
          <Canvas state={state} dispatch={dispatch} externalGuides={externalGuides} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={25} minSize={15} maxSize={35}>
          <InspectorRight state={state} dispatch={dispatch} />
        </ResizablePanel>
      </ResizablePanelGroup>
      <DevQAPanel state={state} dispatch={dispatch} eventLog={eventLog} setExternalGuides={setExternalGuides} />
    </div>
  );
}
