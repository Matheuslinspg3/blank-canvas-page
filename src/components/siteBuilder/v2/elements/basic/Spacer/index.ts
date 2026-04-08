import { registerElement, ZERO_PADDING_STYLES } from '../../../elementRegistry';
import { SeparatorHorizontal } from 'lucide-react';
import { SpacerElement } from './SpacerElement';
import { SpacerInspector } from './SpacerInspector';

registerElement({
  type: 'spacer',
  label: 'Espaçador',
  category: 'basic',
  icon: SeparatorHorizontal,
  defaultProps: { height: 32 },
  defaultStyles: { ...ZERO_PADDING_STYLES },
  Component: SpacerElement,
  Inspector: SpacerInspector,
});
