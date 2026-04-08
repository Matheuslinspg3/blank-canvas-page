import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'properties-grid',
  label: 'Imóveis — Grid',
  category: 'properties',
  thumbnail: placeholderThumb('properties', 'Property Grid'),
  build: (theme: SiteTheme) =>
    section(
      [row([col(12, [
        el('heading', { text: 'Imóveis em Destaque', level: 'h2', fontSize: 28, fontWeight: 'bold' }, { textAlign: 'center', paddingBottom: 16 }),
        el('property_list', { heading: '', source: 'featured', columns: 3, limit: 6, cardVariant: 'vertical' }),
      ])])],
      { paddingTop: 64, paddingBottom: 64 },
      'Imóveis Grid',
    ),
});
