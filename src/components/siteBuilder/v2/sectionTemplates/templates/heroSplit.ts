import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'hero-split',
  label: 'Hero — Dividido',
  category: 'hero',
  thumbnail: placeholderThumb('hero', 'Hero Split'),
  build: (theme: SiteTheme) =>
    section(
      [row([
        col(6, [
          el('heading', { text: 'Sua nova casa está aqui', level: 'h1', fontSize: 40, fontWeight: 'bold' }, { paddingBottom: 8 }),
          el('paragraph', { text: 'Imóveis selecionados para venda e locação com as melhores condições do mercado.', fontSize: 16, lineHeight: '1.7' }, { paddingBottom: 24 }),
          el('button', { label: 'Fale conosco', link: '#contato', variant: 'primary', size: 'lg' }),
        ], { verticalAlign: 'center', paddingRight: 32 }),
        col(6, [
          el('image', { src: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', alt: 'Casa moderna', objectFit: 'cover', maxHeight: 400 }),
        ]),
      ], { gap: 24 })],
      { paddingTop: 80, paddingBottom: 80 },
      'Hero Split',
    ),
});
