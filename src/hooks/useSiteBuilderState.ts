import { useReducer } from 'react';
import type { SiteLayout, SiteTheme, SiteMeta, BlockType, BlockVariant, Block } from '@/types/siteBuilder';
import { BlockRegistry } from '@/components/siteBuilder/blockRegistry';
import '@/components/siteBuilder/blocks';

export interface SiteBuilderState {
  past: SiteLayout[];
  present: SiteLayout;
  future: SiteLayout[];
  selectedBlockId: string | null;
  viewport: 'desktop' | 'mobile';
  lastSavedAt: Date | null;
  isDirty: boolean;
}

export type SiteBuilderAction =
  | { type: 'SET_LAYOUT'; layout: SiteLayout }
  | { type: 'UPDATE_BLOCK_PROPS'; id: string; props: any }
  | { type: 'TOGGLE_VISIBILITY'; id: string }
  | { type: 'REORDER_BLOCKS'; order: string[] }
  | { type: 'ADD_BLOCK'; blockType: BlockType; variant: BlockVariant }
  | { type: 'DELETE_BLOCK'; id: string }
  | { type: 'CHANGE_VARIANT'; id: string; variant: BlockVariant }
  | { type: 'UPDATE_THEME'; theme: Partial<SiteTheme> }
  | { type: 'UPDATE_META'; meta: Partial<SiteMeta> }
  | { type: 'SELECT_BLOCK'; id: string | null }
  | { type: 'SET_VIEWPORT'; viewport: 'desktop' | 'mobile' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'MARK_SAVED'; at: Date };

const MAX_HISTORY = 50;

function pushHistory(state: SiteBuilderState): Pick<SiteBuilderState, 'past' | 'future'> {
  return {
    past: [...state.past.slice(-(MAX_HISTORY - 1)), state.present],
    future: [],
  };
}

function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function reducer(state: SiteBuilderState, action: SiteBuilderAction): SiteBuilderState {
  switch (action.type) {
    case 'SET_LAYOUT':
      return { ...state, present: action.layout, past: [], future: [], isDirty: false };

    case 'UPDATE_BLOCK_PROPS': {
      const newBlocks = state.present.blocks.map((b) =>
        b.id === action.id ? { ...b, props: { ...b.props, ...action.props } } : b
      );
      return {
        ...state,
        ...pushHistory(state),
        present: { ...state.present, blocks: newBlocks as Block[] },
        isDirty: true,
      };
    }

    case 'TOGGLE_VISIBILITY': {
      const newBlocks = state.present.blocks.map((b) =>
        b.id === action.id ? { ...b, visible: !b.visible } : b
      );
      return {
        ...state,
        ...pushHistory(state),
        present: { ...state.present, blocks: newBlocks as Block[] },
        isDirty: true,
      };
    }

    case 'REORDER_BLOCKS': {
      const blockMap = new Map(state.present.blocks.map((b) => [b.id, b]));
      const reordered = action.order
        .map((id, i) => {
          const block = blockMap.get(id);
          return block ? { ...block, order: i } : null;
        })
        .filter(Boolean) as Block[];
      return {
        ...state,
        ...pushHistory(state),
        present: { ...state.present, blocks: reordered },
        isDirty: true,
      };
    }

    case 'ADD_BLOCK': {
      const def = BlockRegistry[action.blockType]?.[action.variant];
      if (!def) return state;
      const maxOrder = state.present.blocks.reduce((m, b) => Math.max(m, b.order), -1);
      const newBlock = {
        id: generateBlockId(),
        type: action.blockType,
        variant: action.variant,
        visible: true,
        order: maxOrder + 1,
        props: { ...def.defaultProps },
      } as Block;
      return {
        ...state,
        ...pushHistory(state),
        present: { ...state.present, blocks: [...state.present.blocks, newBlock] },
        isDirty: true,
        selectedBlockId: newBlock.id,
      };
    }

    case 'DELETE_BLOCK': {
      const newBlocks = state.present.blocks
        .filter((b) => b.id !== action.id)
        .map((b, i) => ({ ...b, order: i })) as Block[];
      return {
        ...state,
        ...pushHistory(state),
        present: { ...state.present, blocks: newBlocks },
        isDirty: true,
        selectedBlockId: state.selectedBlockId === action.id ? null : state.selectedBlockId,
      };
    }

    case 'CHANGE_VARIANT': {
      const block = state.present.blocks.find((b) => b.id === action.id);
      if (!block) return state;
      const newDef = BlockRegistry[block.type]?.[action.variant];
      if (!newDef) return state;
      const mergedProps = { ...newDef.defaultProps };
      for (const key of Object.keys(mergedProps)) {
        if (key in block.props) {
          (mergedProps as any)[key] = (block.props as any)[key];
        }
      }
      const newBlocks = state.present.blocks.map((b) =>
        b.id === action.id ? { ...b, variant: action.variant, props: mergedProps } : b
      ) as Block[];
      return {
        ...state,
        ...pushHistory(state),
        present: { ...state.present, blocks: newBlocks },
        isDirty: true,
      };
    }

    case 'UPDATE_THEME':
      return {
        ...state,
        ...pushHistory(state),
        present: { ...state.present, theme: { ...state.present.theme, ...action.theme } },
        isDirty: true,
      };

    case 'UPDATE_META':
      return {
        ...state,
        ...pushHistory(state),
        present: { ...state.present, meta: { ...state.present.meta, ...action.meta } },
        isDirty: true,
      };

    case 'SELECT_BLOCK':
      return { ...state, selectedBlockId: action.id };

    case 'SET_VIEWPORT':
      return { ...state, viewport: action.viewport };

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future].slice(0, MAX_HISTORY),
        isDirty: true,
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        past: [...state.past, state.present].slice(-MAX_HISTORY),
        present: next,
        future: state.future.slice(1),
        isDirty: true,
      };
    }

    case 'MARK_SAVED':
      return { ...state, lastSavedAt: action.at, isDirty: false };

    default:
      return state;
  }
}

export const DEFAULT_SEED_LAYOUT: SiteLayout = {
  version: 1,
  blocks: [
    { id: 'seed-hero', type: 'hero', variant: 'A', visible: true, order: 0, props: BlockRegistry.hero.A?.defaultProps || {} } as Block,
    { id: 'seed-grid', type: 'property_grid', variant: 'A', visible: true, order: 1, props: BlockRegistry.property_grid.A?.defaultProps || {} } as Block,
    { id: 'seed-about', type: 'about', variant: 'A', visible: true, order: 2, props: BlockRegistry.about.A?.defaultProps || {} } as Block,
    { id: 'seed-whatsapp', type: 'whatsapp_cta', variant: 'A', visible: true, order: 3, props: BlockRegistry.whatsapp_cta.A?.defaultProps || {} } as Block,
    { id: 'seed-footer', type: 'footer', variant: 'A', visible: true, order: 4, props: BlockRegistry.footer.A?.defaultProps || {} } as Block,
  ],
  theme: { primaryColor: '#2563eb', secondaryColor: '#1e293b', accentColor: '#f59e0b', fontFamily: 'Inter' },
  meta: { title: '', description: '' },
};

export function useSiteBuilderState(initialLayout?: SiteLayout) {
  const [state, dispatch] = useReducer(reducer, {
    past: [],
    present: initialLayout || DEFAULT_SEED_LAYOUT,
    future: [],
    selectedBlockId: null,
    viewport: 'desktop' as const,
    lastSavedAt: null,
    isDirty: false,
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  return { state, dispatch, canUndo, canRedo };
}
