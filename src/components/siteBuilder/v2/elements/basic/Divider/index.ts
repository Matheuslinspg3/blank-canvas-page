import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Minus } from 'lucide-react';
import { DividerElement } from './DividerElement';
import { DividerInspector } from './DividerInspector';

registerElement({
  type: 'divider',
  label: 'Divisor',
  category: 'basic',
  icon: Minus,
  defaultProps: { thickness: 1, color: '#e5e7eb', style: 'solid', width: 100 },
  defaultStyles: { ...DEFAULT_STYLES, paddingTop: 8, paddingBottom: 8, paddingLeft: 0, paddingRight: 0 },
  Component: DividerElement,
  Inspector: DividerInspector,
});
