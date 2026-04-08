import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Hash } from 'lucide-react';
import { CounterElement } from './CounterElement';
import { CounterInspector } from './CounterInspector';

registerElement({
  type: 'counter',
  label: 'Contador',
  category: 'content',
  icon: Hash,
  defaultProps: { value: 150, label: 'Imóveis vendidos', prefix: '', suffix: '+', animationDuration: 2000 },
  defaultStyles: { ...DEFAULT_STYLES, textAlign: 'center' },
  Component: CounterElement,
  Inspector: CounterInspector,
});
