import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { LayoutGrid } from 'lucide-react';
import { PropertyListElement } from './PropertyListElement';
import { PropertyListInspector } from './PropertyListInspector';

registerElement({
  type: 'property_list',
  label: 'Lista de Imóveis',
  category: 'properties',
  icon: LayoutGrid,
  defaultProps: { heading: 'Nossos Imóveis', source: 'all', filterCity: '', filterMinBedrooms: undefined, filterTransactionType: 'all', limit: 6, columns: 3, cardVariant: 'vertical' },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: PropertyListElement,
  Inspector: PropertyListInspector,
});
