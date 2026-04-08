import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'about-with-image',
  label: 'Sobre — Com imagem',
  category: 'about',
  thumbnail: placeholderThumb('about', 'About + Image'),
  build: (theme: SiteTheme) =>
    section(
      [row([
        col(5, [
          el('image', { src: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80', alt: 'Escritório', objectFit: 'cover', maxHeight: 360 }),
        ]),
        col(7, [
          el('heading', { text: 'Quem somos', level: 'h2', fontSize: 28, fontWeight: 'bold' }, { paddingBottom: 8 }),
          el('paragraph', { text: 'Uma equipe apaixonada por imóveis, dedicada a conectar pessoas aos melhores espaços para morar e trabalhar. Transparência, agilidade e compromisso são nossos valores.', fontSize: 16, lineHeight: '1.7' }, { paddingBottom: 16 }),
          el('button', { label: 'Saiba mais', link: '#contato', variant: 'outline', size: 'md' }),
        ], { verticalAlign: 'center', paddingLeft: 32 }),
      ], { gap: 24 })],
      { paddingTop: 64, paddingBottom: 64 },
      'Sobre com imagem',
    ),
});
