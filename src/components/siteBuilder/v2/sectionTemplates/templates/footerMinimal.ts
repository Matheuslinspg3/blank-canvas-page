import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'footer-minimal',
  label: 'Footer — Minimalista',
  category: 'footer',
  thumbnail: placeholderThumb('footer', 'Footer Minimal'),
  build: (theme: SiteTheme) =>
    section(
      [row([col(12, [
        el('paragraph', { text: `© ${new Date().getFullYear()} Imobiliária. Todos os direitos reservados.`, fontSize: 14, color: '#9ca3af' }, { textAlign: 'center' }),
      ])])],
      { paddingTop: 32, paddingBottom: 32, bgColor: '#111827' },
      'Footer Minimal',
    ),
});
