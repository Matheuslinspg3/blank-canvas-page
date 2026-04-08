import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { ListCollapse } from 'lucide-react';
import { AccordionElement } from './AccordionElement';
import { AccordionInspector } from './AccordionInspector';

registerElement({
  type: 'accordion',
  label: 'Acordeão',
  category: 'content',
  icon: ListCollapse,
  defaultProps: { items: [{ question: 'Pergunta frequente 1', answer: 'Resposta aqui.' }, { question: 'Pergunta frequente 2', answer: 'Outra resposta.' }], allowMultiple: false },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: AccordionElement,
  Inspector: AccordionInspector,
});
