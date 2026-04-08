import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'hero-image-bg',
  label: 'Hero — Imagem de fundo',
  category: 'hero',
  thumbnail: placeholderThumb('hero', 'Hero Image BG'),
  build: (theme: SiteTheme) =>
    section(
      [row([col(12, [
        el('heading', { text: 'Encontre o imóvel dos seus sonhos', level: 'h1', color: '#ffffff', fontSize: 48, fontWeight: 'bold' }, { textAlign: 'center', paddingBottom: 8 }),
        el('paragraph', { text: 'As melhores opções de imóveis na sua cidade, com atendimento personalizado.', color: '#ffffffcc', fontSize: 18, lineHeight: '1.6' }, { textAlign: 'center', paddingBottom: 24 }),
        el('button', { label: 'Ver imóveis', link: '#imoveis', variant: 'primary', size: 'lg' }, { textAlign: 'center' }),
      ])])],
      { paddingTop: 120, paddingBottom: 120, bgImage: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&q=80', fullWidth: true },
      'Hero',
    ),
});
