import { useState } from 'react';
import type { BuilderState, BuilderAction } from '@/hooks/useSiteBuilderProState';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EventEntry {
  time: string;
  action: string;
  payload: string;
}

interface DevQAPanelProps {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  eventLog: EventEntry[];
}

export function DevQAPanel({ state, dispatch, eventLog }: DevQAPanelProps) {
  const [open, setOpen] = useState(true);

  // Find first two columns in layout for move tests
  const allColumns: { sectionId: string; rowId: string; columnId: string; sectionName?: string }[] = [];
  state.present.sections.forEach(s => {
    s.rows.forEach(r => {
      r.columns.forEach(c => {
        allColumns.push({ sectionId: s.id, rowId: r.id, columnId: c.id, sectionName: s.name });
      });
    });
  });

  const sel = state.selection;

  const moveElementBetweenColumns = () => {
    // Find first element in first column, move to second column
    for (const s of state.present.sections) {
      for (const r of s.rows) {
        if (r.columns.length >= 2) {
          const srcCol = r.columns[0];
          const dstCol = r.columns[1];
          if (srcCol.elements.length > 0) {
            dispatch({
              type: 'MOVE_ELEMENT_BETWEEN_COLUMNS',
              from: { sectionId: s.id, rowId: r.id, columnId: srcCol.id, elementId: srcCol.elements[0].id },
              to: { sectionId: s.id, rowId: r.id, columnId: dstCol.id },
            });
            return;
          }
        }
      }
    }
    alert('No row with 2+ columns found');
  };

  const moveElementBetweenSections = () => {
    const sections = state.present.sections;
    if (sections.length < 2) return alert('Need 2+ sections');
    const srcSection = sections[0];
    const dstSection = sections[sections.length - 1];
    const srcRow = srcSection.rows[0];
    const dstRow = dstSection.rows[0];
    if (!srcRow || !dstRow) return alert('Missing rows');
    const srcCol = srcRow.columns[0];
    const dstCol = dstRow.columns[0];
    if (!srcCol || !dstCol) return alert('Missing columns');
    if (srcCol.elements.length === 0) return alert('Source column empty');
    dispatch({
      type: 'MOVE_ELEMENT_BETWEEN_COLUMNS',
      from: { sectionId: srcSection.id, rowId: srcRow.id, columnId: srcCol.id, elementId: srcCol.elements[0].id },
      to: { sectionId: dstSection.id, rowId: dstRow.id, columnId: dstCol.id },
    });
  };

  const activateAbsolute = () => {
    if (sel.type === 'column' || sel.type === 'element') {
      dispatch({ type: 'UPDATE_COLUMN_LAYOUT_MODE', sectionId: sel.sectionId, rowId: sel.rowId, columnId: sel.columnId, mode: 'absolute' });
    } else {
      // Activate on first column of first section
      const s = state.present.sections[0];
      if (!s) return;
      const r = s.rows[0];
      if (!r) return;
      const c = r.columns[0];
      if (!c) return;
      dispatch({ type: 'UPDATE_COLUMN_LAYOUT_MODE', sectionId: s.id, rowId: r.id, columnId: c.id, mode: 'absolute' });
    }
  };

  const applyMoveXY = () => {
    if (sel.type !== 'element') return alert('Select an element first');
    dispatch({
      type: 'UPDATE_ELEMENT_LAYOUT',
      sectionId: sel.sectionId, rowId: sel.rowId, columnId: sel.columnId, elementId: sel.elementId,
      layout: { x: 50, y: 80 },
    });
  };

  const applyResize = () => {
    if (sel.type !== 'element') return alert('Select an element first');
    dispatch({
      type: 'UPDATE_ELEMENT_LAYOUT',
      sectionId: sel.sectionId, rowId: sel.rowId, columnId: sel.columnId, elementId: sel.elementId,
      layout: { width: 300, height: 200 },
    });
  };

  const applyZIndex = () => {
    if (sel.type !== 'element') return alert('Select an element first');
    dispatch({
      type: 'UPDATE_ELEMENT_LAYOUT',
      sectionId: sel.sectionId, rowId: sel.rowId, columnId: sel.columnId, elementId: sel.elementId,
      layout: { zIndex: 99 },
    });
  };

  const reorderSections = () => {
    const ids = state.present.sections.map(s => s.id);
    if (ids.length < 2) return;
    const reversed = [...ids].reverse();
    dispatch({ type: 'REORDER_SECTIONS', orderedIds: reversed });
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-[340px]">
      <button
        onClick={() => setOpen(!open)}
        className="self-end bg-amber-500 text-black text-xs font-bold px-3 py-1 rounded"
      >
        {open ? '▼ QA Panel' : '▲ QA Panel'}
      </button>
      {open && (
        <div className="bg-gray-900 border border-amber-500 rounded-lg shadow-2xl text-white text-xs">
          {/* QA Actions */}
          <div className="p-3 border-b border-amber-500/30">
            <div className="font-bold text-amber-400 mb-2">QA Actions</div>
            <div className="grid grid-cols-2 gap-1">
              <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={moveElementBetweenColumns}>
                Move entre colunas
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={moveElementBetweenSections}>
                Move entre seções
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={activateAbsolute}>
                Ativar absolute
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={applyMoveXY}>
                Move X:50 Y:80
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={applyResize}>
                Resize 300×200
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={applyZIndex}>
                zIndex: 99
              </Button>
              <Button size="sm" variant="outline" className="text-[10px] h-7 col-span-2" onClick={reorderSections}>
                Inverter ordem seções
              </Button>
            </div>
            <div className="mt-1 text-[9px] text-gray-400">
              Sel: {sel.type}{sel.type === 'element' ? ` → ${sel.elementId.slice(0,8)}` : sel.type === 'column' ? ` → col ${sel.columnId.slice(0,8)}` : ''}
            </div>
          </div>
          {/* Event Log */}
          <div className="p-3">
            <div className="font-bold text-amber-400 mb-2">Event Log ({eventLog.length})</div>
            <ScrollArea className="h-[160px]">
              {eventLog.length === 0 && <div className="text-gray-500">Nenhum evento ainda</div>}
              {eventLog.map((ev, i) => (
                <div key={i} className="mb-1 border-b border-gray-700 pb-1">
                  <span className="text-gray-400">{ev.time}</span>{' '}
                  <span className="text-amber-300 font-mono">{ev.action}</span>
                  <div className="text-gray-500 truncate">{ev.payload}</div>
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
