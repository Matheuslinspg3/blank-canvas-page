import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'properties-carousel',
  label: 'Imóveis — Carrossel',
  category: 'properties',
  thumbnail: placeholderThumb('properties', 'Property Carousel'),
  build: (theme: SiteTheme) =>
    section(
      [row([col(12, [
        el('heading', { text: 'Nossos Imóveis', level: 'h2', fontSize: 28, fontWeight: 'bold' }, { textAlign: 'center', paddingBottom: 16 }),
        el('property_carousel', { heading: '', source: 'all', limit: 8, autoplay: true, autoplayDelay: 5000, showArrows: true, showDots: true, slidesPerView: 3 }),
      ])])],
      { paddingTop: 64, paddingBottom: 64 },
      'Imóveis Carrossel',
    ),
});
