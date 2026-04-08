import { useMemo, useState, useCallback, CSSProperties } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ElementRegistry } from '@/components/siteBuilder/v2/elementRegistry';
import type { Section, Row, Column, Element as V2Element } from '@/types/siteBuilderV2';
import type { SiteTheme } from '@/types/siteBuilder';
import type { BuilderState, BuilderAction, Selection } from '@/hooks/useSiteBuilderProState';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Copy, Trash2, Layers, ChevronsUp } from 'lucide-react';
import {
  DndContext, DragOverlay, useDraggable, useDroppable,
  PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';

interface Props {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  externalGuides?: { x?: number; y?: number }[];
}

export function Canvas({ state, dispatch, externalGuides = [] }: Props) {
  const { present, selection, hoveredId, viewport, snapEnabled, gridSize } = state;
  const sections = [...present.sections].sort((a, b) => a.order - b.order);
  const isMobile = viewport === 'mobile';
  const [activeDrag, setActiveDrag] = useState<{ element: V2Element; from: { sectionId: string; rowId: string; columnId: string } } | null>(null);
  const [dragGuides, setDragGuides] = useState<{ x?: number; y?: number }[]>([]);

  const allGuides = useMemo(() => [...dragGuides, ...externalGuides], [dragGuides, externalGuides]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as any;
    if (data?.kind === 'element') {
      setActiveDrag({ element: data.element, from: { sectionId: data.sectionId, rowId: data.rowId, columnId: data.columnId } });
    }
  }, []);

  const handleDragMove = useCallback((event: { active: any; delta: { x: number; y: number } }) => {
    if (!activeDrag) return;
    const activeData = event.active.data.current as any;
    if (!activeData || activeData.kind !== 'element') return;

    const el = activeDrag.element;
    const currentX = el.layout?.x ?? 0;
    const currentY = el.layout?.y ?? 0;
    const proposedX = currentX + event.delta.x;
    const proposedY = currentY + event.delta.y;

    const newGuides: { x?: number; y?: number }[] = [];
    const THRESHOLD = 4;

    for (const s of present.sections) {
      if (s.id !== activeData.sectionId) continue;
      for (const r of s.rows) {
        if (r.id !== activeData.rowId) continue;
        for (const c of r.columns) {
          if (c.id !== activeData.columnId || c.layoutMode !== 'absolute') continue;
          for (const other of c.elements) {
            if (other.id === activeData.elementId) continue;
            const ox = other.layout?.x ?? 0;
            const oy = other.layout?.y ?? 0;
            if (Math.abs(proposedX - ox) < THRESHOLD) newGuides.push({ x: ox });
            if (Math.abs(proposedY - oy) < THRESHOLD) newGuides.push({ y: oy });
          }
        }
      }
    }
    setDragGuides(newGuides);
  }, [activeDrag, present.sections]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragGuides([]);
    const { active, over, delta } = event;
    if (!activeDrag || !over) { setActiveDrag(null); return; }

    const overData = over.data.current as any;
    const activeData = active.data.current as any;

    if (overData?.kind === 'column') {
      const sameColumn = activeData.columnId === overData.columnId;

      if (!sameColumn) {
        dispatch({
          type: 'MOVE_ELEMENT_BETWEEN_COLUMNS',
          from: { sectionId: activeData.sectionId, rowId: activeData.rowId, columnId: activeData.columnId, elementId: activeData.elementId },
          to: { sectionId: overData.sectionId, rowId: overData.rowId, columnId: overData.columnId },
        });
      } else if (sameColumn && overData.layoutMode === 'absolute') {
        const el = activeDrag.element;
        const currentX = el.layout?.x ?? 0;
        const currentY = el.layout?.y ?? 0;
        let newX = currentX + delta.x;
        let newY = currentY + delta.y;
        if (snapEnabled) {
          newX = Math.round(newX / gridSize) * gridSize;
          newY = Math.round(newY / gridSize) * gridSize;
        }
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        dispatch({
          type: 'UPDATE_ELEMENT_LAYOUT',
          sectionId: activeData.sectionId, rowId: activeData.rowId, columnId: activeData.columnId, elementId: activeData.elementId,
          layout: { x: newX, y: newY },
        });
      }
    }

    setActiveDrag(null);
  }, [activeDrag, dispatch, snapEnabled, gridSize]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
      <ScrollArea className="h-full bg-muted">
        <div className={cn('min-h-full relative', isMobile ? 'w-[390px] mx-auto shadow-2xl bg-background my-4' : 'w-full bg-background')}>
          {sections.map(s => (
            <EditableSection key={s.id} section={s} theme={present.theme} selection={selection} hoveredId={hoveredId} dispatch={dispatch} isMobile={isMobile} snapEnabled={snapEnabled} gridSize={gridSize} />
          ))}
          {sections.length === 0 && (
            <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Nenhuma seção. Adicione pela sidebar.</div>
          )}
          {/* Alignment guides */}
          {allGuides.map((g, i) => (
            <div key={i}>
              {g.x !== undefined && <div className="absolute top-0 bottom-0 w-px bg-destructive pointer-events-none z-50" style={{ left: g.x }} />}
              {g.y !== undefined && <div className="absolute left-0 right-0 h-px bg-destructive pointer-events-none z-50" style={{ top: g.y }} />}
            </div>
          ))}
        </div>
      </ScrollArea>
      <DragOverlay>
        {activeDrag && (
          <div className="opacity-70 pointer-events-none shadow-xl rounded bg-background p-2 max-w-[200px]">
            <ElementPreview element={activeDrag.element} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function ElementPreview({ element }: { element: V2Element }) {
  const def = ElementRegistry[element.type];
  if (!def) return <span className="text-xs">{element.type}</span>;
  const Icon = def.icon;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="truncate">{def.label}</span>
    </div>
  );
}

// ── Editable Section ─────────────────────────────────────────
function EditableSection({ section, theme, selection, hoveredId, dispatch, isMobile, snapEnabled, gridSize }: {
  section: Section; theme: SiteTheme; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>; isMobile: boolean; snapEnabled: boolean; gridSize: number;
}) {
  const isSelected = selection.type === 'section' && selection.sectionId === section.id;
  const isHovered = hoveredId === section.id;

  const sectionStyle: CSSProperties = useMemo(() => {
    const s: CSSProperties = {
      paddingTop: section.styles.paddingTop ?? 0,
      paddingBottom: section.styles.paddingBottom ?? 0,
      minHeight: section.styles.minHeight || undefined,
      fontFamily: theme.fontFamily || undefined,
    };
    if (section.styles.bgColor) s.backgroundColor = section.styles.bgColor;
    if (section.styles.bgImage) { s.backgroundImage = `url(${section.styles.bgImage})`; s.backgroundSize = 'cover'; s.backgroundPosition = 'center'; }
    if (section.styles.bgGradient) s.backgroundImage = section.styles.bgGradient;
    return s;
  }, [section.styles, theme.fontFamily]);

  if (!section.visible) {
    return (
      <div
        className={cn('relative opacity-30 cursor-pointer', isSelected && 'ring-2 ring-primary ring-offset-2')}
        style={sectionStyle}
        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', selection: { type: 'section', sectionId: section.id } }); }}
        onMouseEnter={() => dispatch({ type: 'SET_HOVER', id: section.id })}
        onMouseLeave={() => dispatch({ type: 'SET_HOVER', id: null })}
      >
        <div className="absolute top-2 right-2 bg-muted text-muted-foreground text-xs px-2 py-1 rounded z-10">Oculto</div>
        <SectionContent section={section} theme={theme} selection={selection} hoveredId={hoveredId} dispatch={dispatch} isMobile={isMobile} snapEnabled={snapEnabled} gridSize={gridSize} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative cursor-pointer transition-all',
        isHovered && !isSelected && 'outline outline-2 outline-accent outline-offset-[-2px]',
        isSelected && 'outline outline-2 outline-primary outline-offset-[-2px]',
      )}
      style={sectionStyle}
      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', selection: { type: 'section', sectionId: section.id } }); }}
      onMouseEnter={() => dispatch({ type: 'SET_HOVER', id: section.id })}
      onMouseLeave={() => dispatch({ type: 'SET_HOVER', id: null })}
    >
      {(isHovered || isSelected) && (
        <div className="absolute top-0 left-0 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 z-20 rounded-br">
          {section.name || 'Seção'}
        </div>
      )}
      <SectionContent section={section} theme={theme} selection={selection} hoveredId={hoveredId} dispatch={dispatch} isMobile={isMobile} snapEnabled={snapEnabled} gridSize={gridSize} />
    </div>
  );
}

function SectionContent({ section, theme, selection, hoveredId, dispatch, isMobile, snapEnabled, gridSize }: {
  section: Section; theme: SiteTheme; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>; isMobile: boolean; snapEnabled: boolean; gridSize: number;
}) {
  const content = section.rows.map(row => (
    <EditableRow key={row.id} row={row} sectionId={section.id} theme={theme} selection={selection} hoveredId={hoveredId} dispatch={dispatch} isMobile={isMobile} snapEnabled={snapEnabled} gridSize={gridSize} />
  ));
  return section.styles.fullWidth ? <>{content}</> : <div className="max-w-7xl mx-auto px-4">{content}</div>;
}

function EditableRow({ row, sectionId, theme, selection, hoveredId, dispatch, isMobile, snapEnabled, gridSize }: {
  row: Row; sectionId: string; theme: SiteTheme; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>; isMobile: boolean; snapEnabled: boolean; gridSize: number;
}) {
  const gridStyle: CSSProperties = {
    display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, minmax(0, 1fr))',
    gap: row.styles.gap ?? 16, marginTop: row.styles.marginTop ?? 0, marginBottom: row.styles.marginBottom ?? 0,
  };
  return (
    <div style={gridStyle}>
      {row.columns.map(col => (
        <EditableColumn key={col.id} column={col} sectionId={sectionId} rowId={row.id} selection={selection} hoveredId={hoveredId} dispatch={dispatch} isMobile={isMobile} snapEnabled={snapEnabled} gridSize={gridSize} />
      ))}
    </div>
  );
}

// ── Editable Column (with droppable + absolute support) ──────
function EditableColumn({ column, sectionId, rowId, selection, hoveredId, dispatch, isMobile, snapEnabled, gridSize }: {
  column: Column; sectionId: string; rowId: string; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>; isMobile: boolean; snapEnabled: boolean; gridSize: number;
}) {
  const isSelected = selection.type === 'column' && selection.columnId === column.id;
  const isAbsolute = column.layoutMode === 'absolute' && !isMobile;

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: { kind: 'column', sectionId, rowId, columnId: column.id, layoutMode: column.layoutMode || 'stack' },
  });

  const baseStyle: CSSProperties = {
    gridColumn: isMobile ? undefined : `span ${column.width} / span ${column.width}`,
    paddingTop: column.styles.paddingTop ?? 0,
    paddingRight: column.styles.paddingRight ?? 0,
    paddingBottom: column.styles.paddingBottom ?? 0,
    paddingLeft: column.styles.paddingLeft ?? 0,
    backgroundColor: column.styles.bgColor || undefined,
  };

  if (isAbsolute) {
    return (
      <div
        ref={setNodeRef}
        style={{ ...baseStyle, position: 'relative', minHeight: column.minHeight ?? 300 }}
        className={cn(
          'transition-all',
          isSelected && 'outline outline-1 outline-dashed outline-primary outline-offset-[-1px]',
          isOver && 'bg-primary/5',
        )}
        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', selection: { type: 'column', sectionId, rowId, columnId: column.id } }); }}
      >
        {column.elements.map(el => (
          <AbsoluteEditableElement key={el.id} element={el} sectionId={sectionId} rowId={rowId} columnId={column.id} selection={selection} hoveredId={hoveredId} dispatch={dispatch} snapEnabled={snapEnabled} gridSize={gridSize} />
        ))}
        {column.elements.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs border-2 border-dashed border-muted rounded">Arraste elementos aqui</div>
        )}
      </div>
    );
  }

  // Stack mode
  return (
    <div
      ref={setNodeRef}
      style={{ ...baseStyle, display: 'flex', flexDirection: 'column', justifyContent: column.styles.verticalAlign === 'center' ? 'center' : column.styles.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start', minHeight: 40 }}
      className={cn(
        'relative transition-all',
        isSelected && 'outline outline-1 outline-dashed outline-primary outline-offset-[-1px]',
        isOver && 'bg-primary/5',
      )}
      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', selection: { type: 'column', sectionId, rowId, columnId: column.id } }); }}
    >
      {column.elements.map(el => (
        <StackEditableElement key={el.id} element={el} sectionId={sectionId} rowId={rowId} columnId={column.id} selection={selection} hoveredId={hoveredId} dispatch={dispatch} />
      ))}
      {column.elements.length === 0 && (
        <div className="flex items-center justify-center h-10 text-muted-foreground text-[10px] border border-dashed border-muted rounded m-1">+ Arraste ou clique</div>
      )}
    </div>
  );
}

// ── Stack Element (draggable) ────────────────────────────────
function StackEditableElement({ element, sectionId, rowId, columnId, selection, hoveredId, dispatch }: {
  element: V2Element; sectionId: string; rowId: string; columnId: string; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>;
}) {
  const def = ElementRegistry[element.type];
  const isSelected = selection.type === 'element' && selection.elementId === element.id;
  const isHovered = hoveredId === element.id;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `element-${element.id}`,
    data: { kind: 'element', sectionId, rowId, columnId, elementId: element.id, element },
  });

  if (!def) return <div className="p-2 text-xs text-destructive border border-destructive rounded">Desconhecido: {element.type}</div>;
  const Comp = def.Component;

  const style: CSSProperties = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 100 : undefined } : {};

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'relative group',
        isHovered && !isSelected && 'outline outline-1 outline-accent outline-offset-1',
        isSelected && 'outline outline-2 outline-primary outline-offset-1',
      )}
      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', selection: { type: 'element', sectionId, rowId, columnId, elementId: element.id } }); }}
      onMouseEnter={() => dispatch({ type: 'SET_HOVER', id: element.id })}
      onMouseLeave={() => dispatch({ type: 'SET_HOVER', id: null })}
    >
      <Comp element={element} isEditing={true} />
      {isSelected && <StackToolbar sectionId={sectionId} rowId={rowId} columnId={columnId} elementId={element.id} dispatch={dispatch} />}
    </div>
  );
}

function StackToolbar({ sectionId, rowId, columnId, elementId, dispatch }: {
  sectionId: string; rowId: string; columnId: string; elementId: string; dispatch: React.Dispatch<BuilderAction>;
}) {
  const btn = "p-1 hover:bg-primary-foreground/20 rounded";
  return (
    <div className="absolute -top-8 right-0 flex items-center gap-0.5 bg-primary text-primary-foreground rounded-md shadow-lg px-1 py-0.5 z-30" onClick={e => e.stopPropagation()}>
      <button onClick={() => dispatch({ type: 'MOVE_ELEMENT_UP', sectionId, rowId, columnId, elementId })} className={btn} title="Mover acima"><ArrowUp className="w-3 h-3" /></button>
      <button onClick={() => dispatch({ type: 'MOVE_ELEMENT_DOWN', sectionId, rowId, columnId, elementId })} className={btn} title="Mover abaixo"><ArrowDown className="w-3 h-3" /></button>
      <button onClick={() => dispatch({ type: 'DUPLICATE_ELEMENT', sectionId, rowId, columnId, elementId })} className={btn} title="Duplicar"><Copy className="w-3 h-3" /></button>
      <button onClick={() => dispatch({ type: 'DELETE_ELEMENT', sectionId, rowId, columnId, elementId })} className={btn} title="Excluir"><Trash2 className="w-3 h-3" /></button>
    </div>
  );
}

// ── Absolute Element (draggable + resizable) ─────────────────
function AbsoluteEditableElement({ element, sectionId, rowId, columnId, selection, hoveredId, dispatch, snapEnabled, gridSize }: {
  element: V2Element; sectionId: string; rowId: string; columnId: string; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>; snapEnabled: boolean; gridSize: number;
}) {
  const def = ElementRegistry[element.type];
  const isSelected = selection.type === 'element' && selection.elementId === element.id;
  const isHovered = hoveredId === element.id;
  const layout = element.layout || { mode: 'absolute' as const, x: 0, y: 0 };
  const [isResizing, setIsResizing] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `element-${element.id}`,
    data: { kind: 'element', sectionId, rowId, columnId, elementId: element.id, element },
  });

  if (!def) return null;
  const Comp = def.Component;

  const x = layout.x ?? 0;
  const y = layout.y ?? 0;
  const w = layout.width;
  const h = layout.height;
  const z = layout.zIndex ?? 1;

  const style: CSSProperties = {
    position: 'absolute',
    left: x, top: y,
    width: w || 'auto', height: h || 'auto',
    zIndex: isDragging ? 100 : z,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = w || 200;
    const startH = h || 100;

    const onMove = (me: MouseEvent) => {
      let newW = startW + (me.clientX - startX);
      let newH = startH + (me.clientY - startY);
      if (snapEnabled) {
        newW = Math.round(newW / gridSize) * gridSize;
        newH = Math.round(newH / gridSize) * gridSize;
      }
      newW = Math.max(32, newW);
      newH = Math.max(32, newH);
      dispatch({
        type: 'UPDATE_ELEMENT_LAYOUT',
        sectionId, rowId, columnId, elementId: element.id,
        layout: { width: newW, height: newH },
      });
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isResizing ? {} : { ...listeners, ...attributes })}
      className={cn(
        'group',
        isHovered && !isSelected && 'outline outline-1 outline-accent outline-offset-1',
        isSelected && 'outline outline-2 outline-primary outline-offset-1',
      )}
      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', selection: { type: 'element', sectionId, rowId, columnId, elementId: element.id } }); }}
      onMouseEnter={() => dispatch({ type: 'SET_HOVER', id: element.id })}
      onMouseLeave={() => dispatch({ type: 'SET_HOVER', id: null })}
    >
      <Comp element={element} isEditing={true} />

      {/* Resize handle SE */}
      {isSelected && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-3 h-3 bg-primary cursor-se-resize z-40 rounded-tl-sm"
          style={{ touchAction: 'none' }}
        />
      )}

      {/* Toolbar */}
      {isSelected && (
        <div className="absolute -top-8 right-0 flex items-center gap-0.5 bg-primary text-primary-foreground rounded-md shadow-lg px-1 py-0.5 z-30" onClick={e => e.stopPropagation()}>
          <button onClick={() => dispatch({ type: 'UPDATE_ELEMENT_LAYOUT', sectionId, rowId, columnId, elementId: element.id, layout: { zIndex: (z || 1) + 1 } })} className="p-1 hover:bg-primary-foreground/20 rounded" title="Trazer pra frente">
            <ChevronsUp className="w-3 h-3" />
          </button>
          <button onClick={() => dispatch({ type: 'UPDATE_ELEMENT_LAYOUT', sectionId, rowId, columnId, elementId: element.id, layout: { zIndex: Math.max(0, (z || 1) - 1) } })} className="p-1 hover:bg-primary-foreground/20 rounded" title="Mandar pra trás">
            <Layers className="w-3 h-3" />
          </button>
          <button onClick={() => dispatch({ type: 'DUPLICATE_ELEMENT', sectionId, rowId, columnId, elementId: element.id })} className="p-1 hover:bg-primary-foreground/20 rounded" title="Duplicar">
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={() => dispatch({ type: 'DELETE_ELEMENT', sectionId, rowId, columnId, elementId: element.id })} className="p-1 hover:bg-destructive/80 rounded" title="Excluir">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
