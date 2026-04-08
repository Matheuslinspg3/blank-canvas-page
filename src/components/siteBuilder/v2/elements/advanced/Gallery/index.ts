import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Images } from 'lucide-react';
import { GalleryElement } from './GalleryElement';
import { GalleryInspector } from './GalleryInspector';

registerElement({
  type: 'gallery',
  label: 'Galeria',
  category: 'advanced',
  icon: Images,
  defaultProps: { images: [], layout: 'grid', columns: 3, gap: 8, lightbox: true },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: GalleryElement,
  Inspector: GalleryInspector,
});
