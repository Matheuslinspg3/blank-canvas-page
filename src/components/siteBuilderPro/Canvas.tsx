import { useMemo, CSSProperties } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ElementRegistry } from '@/components/siteBuilder/v2/elementRegistry';
import type { Section, Row, Column, Element as V2Element } from '@/types/siteBuilderV2';
import type { SiteTheme } from '@/types/siteBuilder';
import type { BuilderState, BuilderAction, Selection } from '@/hooks/useSiteBuilderProState';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Copy, Trash2 } from 'lucide-react';

interface Props {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
}

export function Canvas({ state, dispatch }: Props) {
  const { present, selection, hoveredId, viewport } = state;
  const sections = [...present.sections].sort((a, b) => a.order - b.order);
  const isMobile = viewport === 'mobile';

  return (
    <ScrollArea className="h-full bg-muted">
      <div className={cn('min-h-full', isMobile ? 'w-[390px] mx-auto shadow-2xl bg-background my-4' : 'w-full bg-background')}>
        {sections.map(s => (
          <EditableSection
            key={s.id}
            section={s}
            theme={present.theme}
            selection={selection}
            hoveredId={hoveredId}
            dispatch={dispatch}
            isMobile={isMobile}
          />
        ))}
        {sections.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Nenhuma seção. Adicione pela sidebar.
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ── Editable Section ─────────────────────────────────────────
function EditableSection({ section, theme, selection, hoveredId, dispatch, isMobile }: {
  section: Section; theme: SiteTheme; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>; isMobile: boolean;
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
  }, [section, theme]);

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
        <SectionContent section={section} theme={theme} selection={selection} hoveredId={hoveredId} dispatch={dispatch} isMobile={isMobile} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative cursor-pointer transition-all',
        isHovered && !isSelected && 'outline outline-2 outline-blue-300 outline-offset-[-2px]',
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
      <SectionContent section={section} theme={theme} selection={selection} hoveredId={hoveredId} dispatch={dispatch} isMobile={isMobile} />
    </div>
  );
}

// ── Section content (rows/cols/elements) ─────────────────────
function SectionContent({ section, theme, selection, hoveredId, dispatch, isMobile }: {
  section: Section; theme: SiteTheme; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>; isMobile: boolean;
}) {
  const content = section.rows.map(row => (
    <EditableRow key={row.id} row={row} sectionId={section.id} theme={theme} selection={selection} hoveredId={hoveredId} dispatch={dispatch} isMobile={isMobile} />
  ));

  return section.styles.fullWidth ? <>{content}</> : <div className="max-w-7xl mx-auto px-4">{content}</div>;
}

// ── Editable Row ─────────────────────────────────────────────
function EditableRow({ row, sectionId, theme, selection, hoveredId, dispatch, isMobile }: {
  row: Row; sectionId: string; theme: SiteTheme; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>; isMobile: boolean;
}) {
  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, minmax(0, 1fr))',
    gap: row.styles.gap ?? 16,
    marginTop: row.styles.marginTop ?? 0,
    marginBottom: row.styles.marginBottom ?? 0,
  };

  return (
    <div style={gridStyle}>
      {row.columns.map(col => (
        <EditableColumn key={col.id} column={col} sectionId={sectionId} rowId={row.id} selection={selection} hoveredId={hoveredId} dispatch={dispatch} isMobile={isMobile} />
      ))}
    </div>
  );
}

// ── Editable Column ──────────────────────────────────────────
function EditableColumn({ column, sectionId, rowId, selection, hoveredId, dispatch, isMobile }: {
  column: Column; sectionId: string; rowId: string; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>; isMobile: boolean;
}) {
  const isSelected = selection.type === 'column' && selection.columnId === column.id;
  const colStyle: CSSProperties = {
    gridColumn: isMobile ? undefined : `span ${column.width} / span ${column.width}`,
    paddingTop: column.styles.paddingTop ?? 0,
    paddingRight: column.styles.paddingRight ?? 0,
    paddingBottom: column.styles.paddingBottom ?? 0,
    paddingLeft: column.styles.paddingLeft ?? 0,
    backgroundColor: column.styles.bgColor || undefined,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: column.styles.verticalAlign === 'center' ? 'center' : column.styles.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
    minHeight: 40,
  };

  return (
    <div
      style={colStyle}
      className={cn(
        'relative transition-all',
        isSelected && 'outline outline-1 outline-dashed outline-primary outline-offset-[-1px]',
      )}
      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', selection: { type: 'column', sectionId, rowId, columnId: column.id } }); }}
    >
      {column.elements.map(el => (
        <EditableElement key={el.id} element={el} sectionId={sectionId} rowId={rowId} columnId={column.id} selection={selection} hoveredId={hoveredId} dispatch={dispatch} />
      ))}
    </div>
  );
}

// ── Editable Element ─────────────────────────────────────────
function EditableElement({ element, sectionId, rowId, columnId, selection, hoveredId, dispatch }: {
  element: V2Element; sectionId: string; rowId: string; columnId: string; selection: Selection; hoveredId: string | null;
  dispatch: React.Dispatch<BuilderAction>;
}) {
  const def = ElementRegistry[element.type];
  const isSelected = selection.type === 'element' && selection.elementId === element.id;
  const isHovered = hoveredId === element.id;

  if (!def) return <div className="p-2 text-xs text-destructive border border-destructive rounded">Desconhecido: {element.type}</div>;

  const Comp = def.Component;

  return (
    <div
      className={cn(
        'relative group',
        isHovered && !isSelected && 'outline outline-1 outline-blue-300 outline-offset-1',
        isSelected && 'outline outline-2 outline-primary outline-offset-1',
      )}
      onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT', selection: { type: 'element', sectionId, rowId, columnId, elementId: element.id } }); }}
      onMouseEnter={() => dispatch({ type: 'SET_HOVER', id: element.id })}
      onMouseLeave={() => dispatch({ type: 'SET_HOVER', id: null })}
    >
      <Comp element={element} isEditing={true} />

      {/* Floating toolbar */}
      {isSelected && (
        <div className="absolute -top-8 right-0 flex items-center gap-0.5 bg-primary text-primary-foreground rounded-md shadow-lg px-1 py-0.5 z-30">
          <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_ELEMENT_UP', sectionId, rowId, columnId, elementId: element.id }); }} className="p-1 hover:bg-primary-foreground/20 rounded" title="Mover acima">
            <ArrowUp className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_ELEMENT_DOWN', sectionId, rowId, columnId, elementId: element.id }); }} className="p-1 hover:bg-primary-foreground/20 rounded" title="Mover abaixo">
            <ArrowDown className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DUPLICATE_ELEMENT', sectionId, rowId, columnId, elementId: element.id }); }} className="p-1 hover:bg-primary-foreground/20 rounded" title="Duplicar">
            <Copy className="w-3 h-3" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_ELEMENT', sectionId, rowId, columnId, elementId: element.id }); }} className="p-1 hover:bg-red-400/80 rounded" title="Excluir">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
