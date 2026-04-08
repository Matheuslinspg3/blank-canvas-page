import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Sparkle } from 'lucide-react';
import { IconElement } from './IconElement';
import { IconInspector } from './IconInspector';

registerElement({
  type: 'icon',
  label: 'Ícone',
  category: 'media',
  icon: Sparkle,
  defaultProps: { iconName: 'Star', size: 32, color: '' },
  defaultStyles: { ...DEFAULT_STYLES, textAlign: 'center' },
  Component: IconElement,
  Inspector: IconInspector,
});
