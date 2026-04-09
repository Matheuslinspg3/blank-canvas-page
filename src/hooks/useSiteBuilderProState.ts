import { useReducer } from 'react';
import type { SiteLayoutV2, Section, Row, Column, Element, ElementType, ElementStyles, ElementLayout } from '@/types/siteBuilderV2';
import type { SiteTheme, SiteMeta } from '@/types/siteBuilder';
import { ElementRegistry, DEFAULT_STYLES } from '@/components/siteBuilder/v2/elementRegistry';
import { SectionTemplateRegistry } from '@/components/siteBuilder/v2/sectionTemplates';

// ── Selection ────────────────────────────────────────────────
export type Selection =
  | { type: 'none' }
  | { type: 'section'; sectionId: string }
  | { type: 'column'; sectionId: string; rowId: string; columnId: string }
  | { type: 'element'; sectionId: string; rowId: string; columnId: string; elementId: string };

// ── State ────────────────────────────────────────────────────
export interface BuilderState {
  past: SiteLayoutV2[];
  present: SiteLayoutV2;
  future: SiteLayoutV2[];
  selection: Selection;
  viewport: 'desktop' | 'mobile';
  hoveredId: string | null;
  lastSavedAt: Date | null;
  isDirty: boolean;
  snapEnabled: boolean;
  gridSize: number;
  activePageId: string | null; // null = homepage
}

// ── Actions ──────────────────────────────────────────────────
export type BuilderAction =
  | { type: 'LOAD_LAYOUT'; layout: SiteLayoutV2 }
  | { type: 'SELECT'; selection: Selection }
  | { type: 'SET_HOVER'; id: string | null }
  | { type: 'SET_VIEWPORT'; viewport: 'desktop' | 'mobile' }
  | { type: 'TOGGLE_SNAP' }
  | { type: 'SET_GRID_SIZE'; size: number }
  | { type: 'ADD_SECTION'; templateId: string }
  | { type: 'DELETE_SECTION'; sectionId: string }
  | { type: 'TOGGLE_SECTION_VISIBILITY'; sectionId: string }
  | { type: 'REORDER_SECTIONS'; orderedIds: string[] }
  | { type: 'UPDATE_SECTION_STYLES'; sectionId: string; styles: Partial<Section['styles']> }
  | { type: 'UPDATE_SECTION_NAME'; sectionId: string; name: string }
  | { type: 'ADD_ROW'; sectionId: string; columnsConfig: number[] }
  | { type: 'DELETE_ROW'; sectionId: string; rowId: string }
  | { type: 'ADD_ELEMENT'; sectionId: string; rowId: string; columnId: string; elementType: ElementType; index?: number }
  | { type: 'DELETE_ELEMENT'; sectionId: string; rowId: string; columnId: string; elementId: string }
  | { type: 'UPDATE_ELEMENT_PROPS'; sectionId: string; rowId: string; columnId: string; elementId: string; props: any }
  | { type: 'UPDATE_ELEMENT_STYLES'; sectionId: string; rowId: string; columnId: string; elementId: string; styles: ElementStyles }
  | { type: 'DUPLICATE_ELEMENT'; sectionId: string; rowId: string; columnId: string; elementId: string }
  | { type: 'MOVE_ELEMENT_UP'; sectionId: string; rowId: string; columnId: string; elementId: string }
  | { type: 'MOVE_ELEMENT_DOWN'; sectionId: string; rowId: string; columnId: string; elementId: string }
  | { type: 'UPDATE_COLUMN_STYLES'; sectionId: string; rowId: string; columnId: string; styles: Partial<Column['styles']> }
  | { type: 'UPDATE_COLUMN_WIDTH'; sectionId: string; rowId: string; columnId: string; width: number }
  | { type: 'UPDATE_COLUMN_LAYOUT_MODE'; sectionId: string; rowId: string; columnId: string; mode: 'stack' | 'absolute' }
  | { type: 'UPDATE_COLUMN_MIN_HEIGHT'; sectionId: string; rowId: string; columnId: string; minHeight: number }
  | { type: 'UPDATE_ELEMENT_LAYOUT'; sectionId: string; rowId: string; columnId: string; elementId: string; layout: Partial<ElementLayout> }
  | { type: 'MOVE_ELEMENT_BETWEEN_COLUMNS'; from: { sectionId: string; rowId: string; columnId: string; elementId: string }; to: { sectionId: string; rowId: string; columnId: string } }
  | { type: 'UPDATE_THEME'; theme: Partial<SiteTheme> }
  | { type: 'UPDATE_META'; meta: Partial<SiteMeta> }
  | { type: 'ADD_PAGE'; slug: string; title: string }
  | { type: 'DELETE_PAGE'; pageId: string }
  | { type: 'UPDATE_PAGE'; pageId: string; updates: Partial<Pick<import('@/types/siteBuilderV2').SitePage, 'slug' | 'title' | 'seo'>> }
  | { type: 'UPDATE_NAVIGATION'; navigation: import('@/types/siteBuilderV2').NavItem[] }
  | { type: 'SET_ACTIVE_PAGE'; pageId: string | null }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'MARK_SAVED'; at: Date };

const uid = () => crypto.randomUUID();
const MAX_HISTORY = 50;

// ── Helper: push to history ──────────────────────────────────
function withHistory(state: BuilderState, newPresent: SiteLayoutV2): BuilderState {
  return {
    ...state,
    past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
    present: newPresent,
    future: [],
    isDirty: true,
  };
}

// ── Page-aware section access ────────────────────────────────
function getSections(layout: SiteLayoutV2, pageId: string | null): Section[] {
  if (!pageId) return layout.sections;
  const page = (layout.pages || []).find(p => p.id === pageId);
  return page?.sections || [];
}
function setSections(layout: SiteLayoutV2, pageId: string | null, sections: Section[]): SiteLayoutV2 {
  if (!pageId) return { ...layout, sections };
  return { ...layout, pages: (layout.pages || []).map(p => p.id === pageId ? { ...p, sections } : p) };
}

// ── Immutable helpers ────────────────────────────────────────
function mapSections(layout: SiteLayoutV2, sectionId: string, fn: (s: Section) => Section): SiteLayoutV2 {
  // Search in homepage sections
  if (layout.sections.some(s => s.id === sectionId)) {
    return { ...layout, sections: layout.sections.map(s => s.id === sectionId ? fn(s) : s) };
  }
  // Search in page sections
  if (layout.pages) {
    return { ...layout, pages: layout.pages.map(p => ({
      ...p,
      sections: p.sections.map(s => s.id === sectionId ? fn(s) : s),
    })) };
  }
  return layout;
}
function mapRows(layout: SiteLayoutV2, sectionId: string, rowId: string, fn: (r: Row) => Row): SiteLayoutV2 {
  return mapSections(layout, sectionId, s => ({ ...s, rows: s.rows.map(r => r.id === rowId ? fn(r) : r) }));
}
function mapColumns(layout: SiteLayoutV2, sectionId: string, rowId: string, columnId: string, fn: (c: Column) => Column): SiteLayoutV2 {
  return mapRows(layout, sectionId, rowId, r => ({ ...r, columns: r.columns.map(c => c.id === columnId ? fn(c) : c) }));
}
function mapElements(layout: SiteLayoutV2, sectionId: string, rowId: string, columnId: string, fn: (els: Element[]) => Element[]): SiteLayoutV2 {
  return mapColumns(layout, sectionId, rowId, columnId, c => ({ ...c, elements: fn(c.elements) }));
}

function findElementInLayout(layout: SiteLayoutV2, sectionId: string, rowId: string, columnId: string, elementId: string): Element | undefined {
  const section = layout.sections.find(s => s.id === sectionId);
  if (!section) return undefined;
  const row = section.rows.find(r => r.id === rowId);
  if (!row) return undefined;
  const col = row.columns.find(c => c.id === columnId);
  if (!col) return undefined;
  return col.elements.find(e => e.id === elementId);
}

// ── Reducer ──────────────────────────────────────────────────
function reducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'LOAD_LAYOUT':
      return { ...state, present: action.layout, past: [], future: [], isDirty: false, selection: { type: 'none' } };

    case 'SELECT':
      return { ...state, selection: action.selection };

    case 'SET_HOVER':
      return { ...state, hoveredId: action.id };

    case 'SET_VIEWPORT':
      return { ...state, viewport: action.viewport };

    case 'TOGGLE_SNAP':
      return { ...state, snapEnabled: !state.snapEnabled };

    case 'SET_GRID_SIZE':
      return { ...state, gridSize: action.size };

    case 'ADD_SECTION': {
      const tmpl = SectionTemplateRegistry.find(t => t.id === action.templateId);
      if (!tmpl) return state;
      const newSection = tmpl.build(state.present.theme);
      const currentSections = getSections(state.present, state.activePageId);
      newSection.order = currentSections.length;
      return withHistory(state, setSections(state.present, state.activePageId, [...currentSections, newSection]));
    }

    case 'DELETE_SECTION': {
      const currentSections = getSections(state.present, state.activePageId);
      const newLayout = setSections(state.present, state.activePageId, currentSections.filter(s => s.id !== action.sectionId));
      const newState = withHistory(state, newLayout);
      if (state.selection.type !== 'none' && 'sectionId' in state.selection && state.selection.sectionId === action.sectionId) {
        newState.selection = { type: 'none' };
      }
      return newState;
    }

    case 'TOGGLE_SECTION_VISIBILITY': {
      return withHistory(state, mapSections(state.present, action.sectionId, s => ({ ...s, visible: !s.visible })));
    }

    case 'REORDER_SECTIONS': {
      const currentSections = getSections(state.present, state.activePageId);
      const map = new Map(currentSections.map(s => [s.id, s]));
      const reordered = action.orderedIds.map((id, i) => ({ ...map.get(id)!, order: i }));
      return withHistory(state, setSections(state.present, state.activePageId, reordered));
    }

    case 'UPDATE_SECTION_STYLES':
      return withHistory(state, mapSections(state.present, action.sectionId, s => ({ ...s, styles: { ...s.styles, ...action.styles } })));

    case 'UPDATE_SECTION_NAME':
      return withHistory(state, mapSections(state.present, action.sectionId, s => ({ ...s, name: action.name })));

    case 'ADD_ROW': {
      const newRow: Row = {
        id: uid(), columns: action.columnsConfig.map(w => ({ id: uid(), width: w, elements: [], styles: {} })), styles: { gap: 16 },
      };
      return withHistory(state, mapSections(state.present, action.sectionId, s => ({ ...s, rows: [...s.rows, newRow] })));
    }

    case 'DELETE_ROW':
      return withHistory(state, mapSections(state.present, action.sectionId, s => ({ ...s, rows: s.rows.filter(r => r.id !== action.rowId) })));

    case 'ADD_ELEMENT': {
      const def = ElementRegistry[action.elementType];
      if (!def) return state;
      const newEl: Element = { id: uid(), type: action.elementType, props: { ...def.defaultProps }, styles: { ...def.defaultStyles } };
      const newLayout = mapElements(state.present, action.sectionId, action.rowId, action.columnId, els => {
        const idx = action.index ?? els.length;
        const copy = [...els];
        copy.splice(idx, 0, newEl);
        return copy;
      });
      const newState = withHistory(state, newLayout);
      newState.selection = { type: 'element', sectionId: action.sectionId, rowId: action.rowId, columnId: action.columnId, elementId: newEl.id };
      return newState;
    }

    case 'DELETE_ELEMENT': {
      const newLayout = mapElements(state.present, action.sectionId, action.rowId, action.columnId, els => els.filter(e => e.id !== action.elementId));
      const newState = withHistory(state, newLayout);
      if (state.selection.type === 'element' && state.selection.elementId === action.elementId) newState.selection = { type: 'none' };
      return newState;
    }

    case 'UPDATE_ELEMENT_PROPS':
      return withHistory(state, mapElements(state.present, action.sectionId, action.rowId, action.columnId, els =>
        els.map(e => e.id === action.elementId ? { ...e, props: action.props } : e)));

    case 'UPDATE_ELEMENT_STYLES':
      return withHistory(state, mapElements(state.present, action.sectionId, action.rowId, action.columnId, els =>
        els.map(e => e.id === action.elementId ? { ...e, styles: action.styles } : e)));

    case 'UPDATE_ELEMENT_LAYOUT':
      return withHistory(state, mapElements(state.present, action.sectionId, action.rowId, action.columnId, els =>
        els.map(e => e.id === action.elementId ? { ...e, layout: { ...(e.layout || { mode: 'absolute' }), ...action.layout } } : e)));

    case 'DUPLICATE_ELEMENT': {
      return withHistory(state, mapElements(state.present, action.sectionId, action.rowId, action.columnId, els => {
        const idx = els.findIndex(e => e.id === action.elementId);
        if (idx < 0) return els;
        const clone = { ...els[idx], id: uid(), props: { ...els[idx].props }, styles: { ...els[idx].styles }, layout: els[idx].layout ? { ...els[idx].layout } : undefined };
        const copy = [...els];
        copy.splice(idx + 1, 0, clone as Element);
        return copy;
      }));
    }

    case 'MOVE_ELEMENT_UP': {
      return withHistory(state, mapElements(state.present, action.sectionId, action.rowId, action.columnId, els => {
        const idx = els.findIndex(e => e.id === action.elementId);
        if (idx <= 0) return els;
        const copy = [...els];
        [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
        return copy;
      }));
    }

    case 'MOVE_ELEMENT_DOWN': {
      return withHistory(state, mapElements(state.present, action.sectionId, action.rowId, action.columnId, els => {
        const idx = els.findIndex(e => e.id === action.elementId);
        if (idx < 0 || idx >= els.length - 1) return els;
        const copy = [...els];
        [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
        return copy;
      }));
    }

    case 'UPDATE_COLUMN_STYLES':
      return withHistory(state, mapColumns(state.present, action.sectionId, action.rowId, action.columnId, c => ({ ...c, styles: { ...c.styles, ...action.styles } })));

    case 'UPDATE_COLUMN_WIDTH':
      return withHistory(state, mapColumns(state.present, action.sectionId, action.rowId, action.columnId, c => ({ ...c, width: action.width })));

    case 'UPDATE_COLUMN_LAYOUT_MODE': {
      return withHistory(state, mapColumns(state.present, action.sectionId, action.rowId, action.columnId, c => {
        if (action.mode === 'absolute' && c.layoutMode !== 'absolute') {
          // Auto-populate element layouts when switching to absolute
          const updatedElements = c.elements.map((el, i) => ({
            ...el,
            layout: el.layout?.mode === 'absolute' ? el.layout : { mode: 'absolute' as const, x: 16, y: i * 60, zIndex: i + 1 },
          }));
          return { ...c, layoutMode: action.mode, minHeight: c.minHeight ?? 300, elements: updatedElements };
        }
        return { ...c, layoutMode: action.mode };
      }));
    }

    case 'UPDATE_COLUMN_MIN_HEIGHT':
      return withHistory(state, mapColumns(state.present, action.sectionId, action.rowId, action.columnId, c => ({ ...c, minHeight: action.minHeight })));

    case 'MOVE_ELEMENT_BETWEEN_COLUMNS': {
      const el = findElementInLayout(state.present, action.from.sectionId, action.from.rowId, action.from.columnId, action.from.elementId);
      if (!el) return state;
      const clonedEl = { ...el, props: { ...el.props }, styles: { ...el.styles }, layout: undefined };
      // Remove from source
      let layout = mapElements(state.present, action.from.sectionId, action.from.rowId, action.from.columnId, els => els.filter(e => e.id !== action.from.elementId));
      // Add to target
      layout = mapElements(layout, action.to.sectionId, action.to.rowId, action.to.columnId, els => [...els, clonedEl]);
      const newState = withHistory(state, layout);
      newState.selection = { type: 'element', sectionId: action.to.sectionId, rowId: action.to.rowId, columnId: action.to.columnId, elementId: clonedEl.id };
      return newState;
    }

    case 'UPDATE_THEME':
      return withHistory(state, { ...state.present, theme: { ...state.present.theme, ...action.theme } });

    case 'UPDATE_META':
      return withHistory(state, { ...state.present, meta: { ...state.present.meta, ...action.meta } });

    case 'ADD_PAGE': {
      const newPage: import('@/types/siteBuilderV2').SitePage = {
        id: uid(), slug: action.slug, title: action.title, sections: [],
        seo: { title: action.title },
      };
      const pages = [...(state.present.pages || []), newPage];
      return withHistory(state, { ...state.present, pages });
    }

    case 'DELETE_PAGE': {
      const pages = (state.present.pages || []).filter(p => p.id !== action.pageId);
      const newState = withHistory(state, { ...state.present, pages });
      if (state.activePageId === action.pageId) newState.activePageId = null;
      return newState;
    }

    case 'UPDATE_PAGE': {
      const pages = (state.present.pages || []).map(p =>
        p.id === action.pageId ? { ...p, ...action.updates } : p
      );
      return withHistory(state, { ...state.present, pages });
    }

    case 'UPDATE_NAVIGATION':
      return withHistory(state, { ...state.present, navigation: action.navigation });

    case 'SET_ACTIVE_PAGE':
      return { ...state, activePageId: action.pageId, selection: { type: 'none' } };

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return { ...state, past: state.past.slice(0, -1), present: prev, future: [state.present, ...state.future], isDirty: true };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return { ...state, past: [...state.past, state.present], present: next, future: state.future.slice(1), isDirty: true };
    }

    case 'MARK_SAVED':
      return { ...state, isDirty: false, lastSavedAt: action.at };

    default:
      return state;
  }
}

// ── Empty layout ─────────────────────────────────────────────
const EMPTY_LAYOUT: SiteLayoutV2 = {
  version: 2, sections: [],
  theme: { primaryColor: '#2563eb', secondaryColor: '#1e293b', accentColor: '#f59e0b', fontFamily: 'Inter' },
  meta: { title: '', description: '' },
};

const INITIAL_STATE: BuilderState = {
  past: [], present: EMPTY_LAYOUT, future: [],
  selection: { type: 'none' }, viewport: 'desktop', hoveredId: null,
  lastSavedAt: null, isDirty: false, snapEnabled: true, gridSize: 8,
  activePageId: null,
};

export function useSiteBuilderProState() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  return { state, dispatch };
}

// Re-export from shared helper for backward compatibility
export { buildInitialSiteLayoutV2 as buildSeedLayout } from '@/lib/buildInitialSiteLayoutV2';
