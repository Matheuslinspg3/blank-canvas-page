import { LayoutGrid, Rows3 } from 'lucide-react';
import { BlockRegistry } from '../../blockRegistry';
import { PropertyGridA } from './PropertyGridA';
import { PropertyGridAInspector } from './PropertyGridAInspector';
import { PropertyGridB } from './PropertyGridB';
import { PropertyGridBInspector } from './PropertyGridBInspector';

BlockRegistry.property_grid.A = {
  label: 'Imóveis — Grid vertical',
  icon: LayoutGrid,
  defaultProps: { title: 'Imóveis disponíveis', subtitle: 'Confira as melhores opções', columns: 3, maxItems: 6, showFilters: false },
  Component: PropertyGridA as any,
  Inspector: PropertyGridAInspector as any,
};

BlockRegistry.property_grid.B = {
  label: 'Imóveis — Cards horizontais',
  icon: Rows3,
  defaultProps: { title: 'Nosso portfólio', subtitle: '', columns: 2, maxItems: 6, cardStyle: 'rounded' },
  Component: PropertyGridB as any,
  Inspector: PropertyGridBInspector as any,
};
