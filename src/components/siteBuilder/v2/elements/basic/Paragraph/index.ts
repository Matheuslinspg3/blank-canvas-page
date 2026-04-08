import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Type } from 'lucide-react';
import { Paragraph } from './Paragraph';
import { ParagraphInspector } from './ParagraphInspector';

registerElement({
  type: 'paragraph',
  label: 'Parágrafo',
  category: 'basic',
  icon: Type,
  defaultProps: { text: 'Parágrafo de texto. Clique para editar.', color: '', fontSize: undefined, lineHeight: '1.6' },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: Paragraph,
  Inspector: ParagraphInspector,
});
