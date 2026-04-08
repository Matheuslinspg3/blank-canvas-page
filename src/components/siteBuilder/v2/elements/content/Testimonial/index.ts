import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Quote } from 'lucide-react';
import { TestimonialElement } from './TestimonialElement';
import { TestimonialInspector } from './TestimonialInspector';

registerElement({
  type: 'testimonial',
  label: 'Depoimento',
  category: 'content',
  icon: Quote,
  defaultProps: { quote: 'Excelente atendimento e ótimos imóveis!', authorName: 'Maria Silva', authorRole: 'Cliente', authorPhoto: '', rating: 5 },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: TestimonialElement,
  Inspector: TestimonialInspector,
});
