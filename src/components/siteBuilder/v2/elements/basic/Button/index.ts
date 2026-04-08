import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { MousePointerClick } from 'lucide-react';
import { ButtonElement } from './ButtonElement';
import { ButtonInspector } from './ButtonInspector';

registerElement({
  type: 'button',
  label: 'Botão',
  category: 'basic',
  icon: MousePointerClick,
  defaultProps: { label: 'Botão', link: '#', variant: 'primary', size: 'md', icon: '', iconPosition: 'left', openInNewTab: false, fullWidth: false },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: ButtonElement,
  Inspector: ButtonInspector,
});
