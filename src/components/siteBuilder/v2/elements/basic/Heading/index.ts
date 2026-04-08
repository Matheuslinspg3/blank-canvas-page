import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Heading as HeadingIcon } from 'lucide-react';
import { Heading } from './Heading';
import { HeadingInspector } from './HeadingInspector';

registerElement({
  type: 'heading',
  label: 'Título',
  category: 'basic',
  icon: HeadingIcon,
  defaultProps: { text: 'Título', level: 'h2', color: '', fontFamily: 'inherit', fontSize: undefined, fontWeight: 'bold' },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: Heading,
  Inspector: HeadingInspector,
});
