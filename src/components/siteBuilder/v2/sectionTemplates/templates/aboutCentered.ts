import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'about-centered',
  label: 'Sobre — Centralizado',
  category: 'about',
  thumbnail: placeholderThumb('about', 'About Centered'),
  build: (theme: SiteTheme) =>
    section(
      [row([col(12, [
        el('heading', { text: 'Sobre nós', level: 'h2', fontSize: 32, fontWeight: 'bold' }, { textAlign: 'center', paddingBottom: 8 }),
        el('paragraph', { text: 'Somos uma imobiliária comprometida com a excelência no atendimento. Com mais de 15 anos de mercado, ajudamos milhares de famílias a encontrar o lar ideal. Nossa equipe de corretores especializados está pronta para oferecer as melhores opções de imóveis residenciais e comerciais.', fontSize: 16, lineHeight: '1.8' }, { textAlign: 'center', paddingLeft: 48, paddingRight: 48 }),
      ])])],
      { paddingTop: 64, paddingBottom: 64 },
      'Sobre',
    ),
});
