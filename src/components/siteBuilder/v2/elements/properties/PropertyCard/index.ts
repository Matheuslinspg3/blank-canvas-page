import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Home } from 'lucide-react';
import { PropertyCardElement } from './PropertyCardElement';
import { PropertyCardInspector } from './PropertyCardInspector';

registerElement({
  type: 'property_card',
  label: 'Card de Imóvel',
  category: 'properties',
  icon: Home,
  defaultProps: { propertyId: '', variant: 'vertical' },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: PropertyCardElement,
  Inspector: PropertyCardInspector,
});
