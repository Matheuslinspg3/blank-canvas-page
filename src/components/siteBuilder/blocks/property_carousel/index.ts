import { GalleryHorizontalEnd } from 'lucide-react';
import { BlockRegistry } from '../../blockRegistry';
import { PropertyCarouselA } from './PropertyCarouselA';
import { PropertyCarouselAInspector } from './PropertyCarouselAInspector';

BlockRegistry.property_carousel.A = {
  label: 'Imóveis — Carrossel',
  icon: GalleryHorizontalEnd,
  defaultProps: { title: 'Destaques', subtitle: '', maxItems: 8, autoplay: false, interval: 3000 },
  Component: PropertyCarouselA as any,
  Inspector: PropertyCarouselAInspector as any,
};
