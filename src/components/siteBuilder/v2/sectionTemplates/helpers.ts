import type { Section, Row, Column, Element, ElementType, ElementStyles } from '@/types/siteBuilderV2';
import { DEFAULT_STYLES, ZERO_PADDING_STYLES } from '../elementRegistry';

let counter = 0;
export function uid(): string {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${counter++}`;
}

export function el(type: ElementType, props: Record<string, any>, styles?: Partial<ElementStyles>): Element {
  return { id: uid(), type, props, styles: { ...DEFAULT_STYLES, ...styles } };
}

export function elZero(type: ElementType, props: Record<string, any>, styles?: Partial<ElementStyles>): Element {
  return { id: uid(), type, props, styles: { ...ZERO_PADDING_STYLES, ...styles } };
}

export function col(width: number, elements: Element[], styles?: Partial<Column['styles']>): Column {
  return {
    id: uid(),
    width,
    elements,
    styles: { paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0, ...styles },
  };
}

export function row(columns: Column[], styles?: Partial<Row['styles']>): Row {
  return { id: uid(), columns, styles: { gap: 16, marginTop: 0, marginBottom: 0, ...styles } };
}

export function section(rows: Row[], styles: Partial<Section['styles']> = {}, name?: string): Section {
  return {
    id: uid(),
    name,
    rows,
    visible: true,
    order: 0,
    styles: {
      paddingTop: 0,
      paddingBottom: 0,
      fullWidth: false,
      ...styles,
    },
  };
}

// Placeholder SVG thumbnails by category
const COLORS: Record<string, string> = {
  hero: '#2563eb',
  about: '#059669',
  properties: '#d97706',
  contact: '#7c3aed',
  cta: '#dc2626',
  footer: '#475569',
};

export function placeholderThumb(category: string, label: string): string {
  const color = COLORS[category] || '#6b7280';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect fill="${color}" width="320" height="180" rx="8"/><text x="160" y="90" text-anchor="middle" dominant-baseline="central" fill="white" font-family="sans-serif" font-size="14" font-weight="bold">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}
