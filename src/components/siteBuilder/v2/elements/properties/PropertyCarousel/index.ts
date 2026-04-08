import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { GalleryHorizontalEnd } from 'lucide-react';
import { PropertyCarouselElement } from './PropertyCarouselElement';
import { PropertyCarouselInspector } from './PropertyCarouselInspector';

registerElement({
  type: 'property_carousel',
  label: 'Carrossel de Imóveis',
  category: 'properties',
  icon: GalleryHorizontalEnd,
  defaultProps: { heading: 'Imóveis em Destaque', source: 'featured', limit: 9, autoplay: true, autoplayDelay: 3000, showArrows: true, showDots: true, slidesPerView: 3 },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: PropertyCarouselElement,
  Inspector: PropertyCarouselInspector,
});
