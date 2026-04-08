import type { ElementType, Element, ElementStyles } from '@/types/siteBuilderV2';
import { ComponentType } from 'react';

export interface ElementDefinition {
  type: ElementType;
  label: string;
  category: 'basic' | 'media' | 'properties' | 'content' | 'advanced';
  icon: ComponentType<any>;
  defaultProps: Record<string, any>;
  defaultStyles: ElementStyles;
  Component: ComponentType<{ element: Element; isEditing?: boolean }>;
  Inspector: ComponentType<{ element: Element; onChange: (props: any, styles?: ElementStyles) => void }>;
}

export const ElementRegistry: Partial<Record<ElementType, ElementDefinition>> = {};

export function registerElement(def: ElementDefinition) {
  ElementRegistry[def.type] = def;
}

export const DEFAULT_STYLES: ElementStyles = {
  paddingTop: 16,
  paddingRight: 16,
  paddingBottom: 16,
  paddingLeft: 16,
  marginTop: 0,
  marginBottom: 0,
  borderRadius: 0,
  borderWidth: 0,
  borderColor: '#e5e7eb',
  borderStyle: 'none',
  boxShadow: 'none',
  textAlign: 'left',
  hideOnMobile: false,
  hideOnDesktop: false,
};

export const ZERO_PADDING_STYLES: ElementStyles = {
  ...DEFAULT_STYLES,
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
};
