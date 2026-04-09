import type { SiteTheme, SiteMeta } from './siteBuilder';

// ── Element types ─────────────────────────────────────
export type ElementType =
  // Básicos (6)
  | 'heading' | 'paragraph' | 'image' | 'button' | 'spacer' | 'divider'
  // Mídia/contato (5)
  | 'icon' | 'video' | 'map' | 'contact_form' | 'whatsapp_button'
  // Imóveis (3)
  | 'property_card' | 'property_list' | 'property_carousel'
  // Conteúdo (4)
  | 'testimonial' | 'counter' | 'tabs' | 'accordion'
  // Avançados (5)
  | 'form_builder' | 'gallery' | 'timeline' | 'pricing_table' | 'embed_html';

// ── Estilos comuns a todo elemento ────────────────────
export interface ElementStyles {
  // Spacing
  paddingTop?: number; paddingRight?: number; paddingBottom?: number; paddingLeft?: number;
  marginTop?: number; marginBottom?: number;
  // Background
  bgColor?: string;
  bgImage?: string;
  // Border
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  borderStyle?: 'none' | 'solid' | 'dashed' | 'dotted';
  // Shadow
  boxShadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  // Alignment
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  // Visibility
  hideOnMobile?: boolean;
  hideOnDesktop?: boolean;
}

// ── Element Layout ────────────────────────────────────
export type ElementLayoutMode = 'stack' | 'absolute';

export interface ElementLayout {
  mode: ElementLayoutMode;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
}

// ── Element ───────────────────────────────────────────
export interface Element {
  id: string;
  type: ElementType;
  props: Record<string, any>;
  styles: ElementStyles;
  layout?: ElementLayout;
}

// ── Column ────────────────────────────────────────────
export interface Column {
  id: string;
  width: number; // 1-12 (CSS Grid spans)
  layoutMode?: 'stack' | 'absolute';
  minHeight?: number;
  elements: Element[];
  styles: {
    paddingTop?: number; paddingRight?: number; paddingBottom?: number; paddingLeft?: number;
    bgColor?: string;
    verticalAlign?: 'top' | 'center' | 'bottom';
  };
}

// ── Row ───────────────────────────────────────────────
export interface Row {
  id: string;
  columns: Column[];
  styles: {
    gap?: number;
    marginTop?: number; marginBottom?: number;
  };
}

// ── Section ───────────────────────────────────────────
export interface Section {
  id: string;
  name?: string;
  anchor?: string;
  rows: Row[];
  visible: boolean;
  order: number;
  styles: {
    paddingTop?: number; paddingBottom?: number;
    bgColor?: string;
    bgImage?: string;
    bgGradient?: string;
    bgVideo?: string;
    fullWidth?: boolean;
    minHeight?: number;
  };
}

// ── Multi-page support ────────────────────────────────
export interface SitePage {
  id: string;
  slug: string;           // 'imoveis', 'sobre', 'contato'
  title: string;          // Display name in nav
  sections: Section[];
  seo?: { title?: string; description?: string };
}

export interface NavItem {
  label: string;
  href: string;           // '/' | '/imoveis' | '/sobre' | '#imoveis'
  type: 'page' | 'anchor' | 'external';
}

// ── Layout v2 ─────────────────────────────────────────
export interface SiteLayoutV2 {
  version: 2;
  sections: Section[];          // Homepage sections
  theme: SiteTheme;
  meta: SiteMeta;
  pages?: SitePage[];           // Additional pages (multi-page mode)
  navigation?: NavItem[];       // Global nav menu
}
