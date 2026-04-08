import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'cta-banner',
  label: 'CTA — Banner',
  category: 'cta',
  thumbnail: placeholderThumb('cta', 'CTA Banner'),
  build: (theme: SiteTheme) =>
    section(
      [row([col(12, [
        el('heading', { text: 'Pronto para encontrar seu imóvel?', level: 'h2', color: '#ffffff', fontSize: 32, fontWeight: 'bold' }, { textAlign: 'center', paddingBottom: 16 }),
        el('button', { label: 'Comece agora', link: '#imoveis', variant: 'outline', size: 'lg' }, { textAlign: 'center' }),
      ])])],
      { paddingTop: 80, paddingBottom: 80, bgColor: theme.primaryColor, fullWidth: true },
      'CTA Banner',
    ),
});
