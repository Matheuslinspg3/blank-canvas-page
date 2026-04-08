import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Clock } from 'lucide-react';
import { TimelineElement } from './TimelineElement';
import { TimelineInspector } from './TimelineInspector';

registerElement({
  type: 'timeline',
  label: 'Linha do Tempo',
  category: 'advanced',
  icon: Clock,
  defaultProps: { items: [{ year: '2020', title: 'Fundação', description: 'Início da empresa.' }, { year: '2023', title: 'Expansão', description: '100 imóveis no portfólio.' }], orientation: 'vertical' },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: TimelineElement,
  Inspector: TimelineInspector,
});
