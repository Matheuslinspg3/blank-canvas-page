import { useReducer, useCallback } from 'react';
import type { SiteLayoutV2, Section, Row, Column, Element, ElementType, ElementStyles } from '@/types/siteBuilderV2';
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
}

// ── Actions ──────────────────────────────────────────────────
export type BuilderAction =
  | { type: 'LOAD_LAYOUT'; layout: SiteLayoutV2 }
  | { type: 'SELECT'; selection: Selection }
  | { type: 'SET_HOVER'; id: string | null }
  | { type: 'SET_VIEWPORT'; viewport: 'desktop' | 'mobile' }
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
  | { type: 'UPDATE_THEME'; theme: Partial<SiteTheme> }
  | { type: 'UPDATE_META'; meta: Partial<SiteMeta> }
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

// ── Helper: update sections immutably ────────────────────────
function mapSections(layout: SiteLayoutV2, sectionId: string, fn: (s: Section) => Section): SiteLayoutV2 {
  return { ...layout, sections: layout.sections.map(s => s.id === sectionId ? fn(s) : s) };
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

    case 'ADD_SECTION': {
      const tmpl = SectionTemplateRegistry.find(t => t.id === action.templateId);
      if (!tmpl) return state;
      const newSection = tmpl.build(state.present.theme);
      newSection.order = state.present.sections.length;
      const newLayout = { ...state.present, sections: [...state.present.sections, newSection] };
      return withHistory(state, newLayout);
    }

    case 'DELETE_SECTION': {
      const newLayout = { ...state.present, sections: state.present.sections.filter(s => s.id !== action.sectionId) };
      const newState = withHistory(state, newLayout);
      if (state.selection.type !== 'none' && 'sectionId' in state.selection && state.selection.sectionId === action.sectionId) {
        newState.selection = { type: 'none' };
      }
      return newState;
    }

    case 'TOGGLE_SECTION_VISIBILITY': {
      const newLayout = mapSections(state.present, action.sectionId, s => ({ ...s, visible: !s.visible }));
      return withHistory(state, newLayout);
    }

    case 'REORDER_SECTIONS': {
      const map = new Map(state.present.sections.map(s => [s.id, s]));
      const reordered = action.orderedIds.map((id, i) => {
        const s = map.get(id)!;
        return { ...s, order: i };
      });
      return withHistory(state, { ...state.present, sections: reordered });
    }

    case 'UPDATE_SECTION_STYLES': {
      const newLayout = mapSections(state.present, action.sectionId, s => ({
        ...s, styles: { ...s.styles, ...action.styles },
      }));
      return withHistory(state, newLayout);
    }

    case 'UPDATE_SECTION_NAME': {
      const newLayout = mapSections(state.present, action.sectionId, s => ({ ...s, name: action.name }));
      return withHistory(state, newLayout);
    }

    case 'ADD_ROW': {
      const newRow: Row = {
        id: uid(),
        columns: action.columnsConfig.map(w => ({
          id: uid(),
          width: w,
          elements: [],
          styles: {},
        })),
        styles: { gap: 16 },
      };
      const newLayout = mapSections(state.present, action.sectionId, s => ({
        ...s, rows: [...s.rows, newRow],
      }));
      return withHistory(state, newLayout);
    }

    case 'DELETE_ROW': {
      const newLayout = mapSections(state.present, action.sectionId, s => ({
        ...s, rows: s.rows.filter(r => r.id !== action.rowId),
      }));
      return withHistory(state, newLayout);
    }

    case 'ADD_ELEMENT': {
      const def = ElementRegistry[action.elementType];
      if (!def) return state;
      const newEl: Element = {
        id: uid(),
        type: action.elementType,
        props: { ...def.defaultProps },
        styles: { ...def.defaultStyles },
      };
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
      const newLayout = mapElements(state.present, action.sectionId, action.rowId, action.columnId, els =>
        els.filter(e => e.id !== action.elementId)
      );
      const newState = withHistory(state, newLayout);
      if (state.selection.type === 'element' && state.selection.elementId === action.elementId) {
        newState.selection = { type: 'none' };
      }
      return newState;
    }

    case 'UPDATE_ELEMENT_PROPS': {
      const newLayout = mapElements(state.present, action.sectionId, action.rowId, action.columnId, els =>
        els.map(e => e.id === action.elementId ? { ...e, props: action.props } : e)
      );
      return withHistory(state, newLayout);
    }

    case 'UPDATE_ELEMENT_STYLES': {
      const newLayout = mapElements(state.present, action.sectionId, action.rowId, action.columnId, els =>
        els.map(e => e.id === action.elementId ? { ...e, styles: action.styles } : e)
      );
      return withHistory(state, newLayout);
    }

    case 'DUPLICATE_ELEMENT': {
      const newLayout = mapElements(state.present, action.sectionId, action.rowId, action.columnId, els => {
        const idx = els.findIndex(e => e.id === action.elementId);
        if (idx < 0) return els;
        const clone = { ...els[idx], id: uid(), props: { ...els[idx].props }, styles: { ...els[idx].styles } };
        const copy = [...els];
        copy.splice(idx + 1, 0, clone);
        return copy;
      });
      return withHistory(state, newLayout);
    }

    case 'MOVE_ELEMENT_UP': {
      const newLayout = mapElements(state.present, action.sectionId, action.rowId, action.columnId, els => {
        const idx = els.findIndex(e => e.id === action.elementId);
        if (idx <= 0) return els;
        const copy = [...els];
        [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
        return copy;
      });
      return withHistory(state, newLayout);
    }

    case 'MOVE_ELEMENT_DOWN': {
      const newLayout = mapElements(state.present, action.sectionId, action.rowId, action.columnId, els => {
        const idx = els.findIndex(e => e.id === action.elementId);
        if (idx < 0 || idx >= els.length - 1) return els;
        const copy = [...els];
        [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
        return copy;
      });
      return withHistory(state, newLayout);
    }

    case 'UPDATE_COLUMN_STYLES': {
      const newLayout = mapColumns(state.present, action.sectionId, action.rowId, action.columnId, c => ({
        ...c, styles: { ...c.styles, ...action.styles },
      }));
      return withHistory(state, newLayout);
    }

    case 'UPDATE_THEME': {
      const newLayout = { ...state.present, theme: { ...state.present.theme, ...action.theme } };
      return withHistory(state, newLayout);
    }

    case 'UPDATE_META': {
      const newLayout = { ...state.present, meta: { ...state.present.meta, ...action.meta } };
      return withHistory(state, newLayout);
    }

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
        isDirty: true,
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        isDirty: true,
      };
    }

    case 'MARK_SAVED':
      return { ...state, isDirty: false, lastSavedAt: action.at };

    default:
      return state;
  }
}

// ── Empty layout ─────────────────────────────────────────────
const EMPTY_LAYOUT: SiteLayoutV2 = {
  version: 2,
  sections: [],
  theme: { primaryColor: '#2563eb', secondaryColor: '#1e293b', accentColor: '#f59e0b', fontFamily: 'Inter' },
  meta: { title: '', description: '' },
};

const INITIAL_STATE: BuilderState = {
  past: [],
  present: EMPTY_LAYOUT,
  future: [],
  selection: { type: 'none' },
  viewport: 'desktop',
  hoveredId: null,
  lastSavedAt: null,
  isDirty: false,
};

export function useSiteBuilderProState() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  return { state, dispatch };
}

export function buildSeedLayout(theme: SiteTheme): SiteLayoutV2 {
  const templateIds = ['hero-split', 'about-with-image', 'properties-grid', 'cta-banner', 'footer-three-col'];
  const sections: Section[] = [];
  templateIds.forEach((tid, i) => {
    const tmpl = SectionTemplateRegistry.find(t => t.id === tid);
    if (tmpl) {
      const s = tmpl.build(theme);
      s.order = i;
      sections.push(s);
    }
  });
  return { version: 2, sections, theme, meta: { title: '', description: '' } };
}
