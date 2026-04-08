import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'hero-minimal',
  label: 'Hero — Minimalista',
  category: 'hero',
  thumbnail: placeholderThumb('hero', 'Hero Minimal'),
  build: (theme: SiteTheme) =>
    section(
      [row([col(12, [
        el('heading', { text: 'Imobiliária Premium', level: 'h1', fontSize: 36, fontWeight: 'bold' }, { textAlign: 'center', paddingBottom: 8 }),
        el('paragraph', { text: 'Experiência e confiança no mercado imobiliário desde 2005.', fontSize: 18, lineHeight: '1.6' }, { textAlign: 'center' }),
      ])])],
      { paddingTop: 80, paddingBottom: 80 },
      'Hero Minimal',
    ),
});
