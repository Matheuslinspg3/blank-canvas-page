import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { PanelTop } from 'lucide-react';
import { TabsElement } from './TabsElement';
import { TabsInspector } from './TabsInspector';

registerElement({
  type: 'tabs',
  label: 'Abas',
  category: 'content',
  icon: PanelTop,
  defaultProps: { tabs: [{ label: 'Tab 1', content: 'Conteúdo da primeira aba.' }, { label: 'Tab 2', content: 'Conteúdo da segunda aba.' }], orientation: 'horizontal' },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: TabsElement,
  Inspector: TabsInspector,
});
