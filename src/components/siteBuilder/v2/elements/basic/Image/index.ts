import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Image } from 'lucide-react';
import { ImageElement } from './ImageElement';
import { ImageInspector } from './ImageInspector';

registerElement({
  type: 'image',
  label: 'Imagem',
  category: 'basic',
  icon: Image,
  defaultProps: { src: '', alt: '', objectFit: 'cover', link: '', openInNewTab: false, maxHeight: undefined },
  defaultStyles: { ...DEFAULT_STYLES, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
  Component: ImageElement,
  Inspector: ImageInspector,
});
