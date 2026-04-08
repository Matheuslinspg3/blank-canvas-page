import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'footer-three-col',
  label: 'Footer — 3 colunas',
  category: 'footer',
  thumbnail: placeholderThumb('footer', 'Footer 3-Col'),
  build: (theme: SiteTheme) =>
    section(
      [row([
        col(4, [
          el('image', { src: '', alt: 'Logo', objectFit: 'contain', maxHeight: 48 }, { paddingBottom: 8 }),
          el('paragraph', { text: 'Imobiliária dedicada a encontrar o melhor imóvel pra você.', fontSize: 14, lineHeight: '1.6' }),
        ]),
        col(4, [
          el('heading', { text: 'Links', level: 'h4', fontSize: 16, fontWeight: 'bold' }, { paddingBottom: 8 }),
          el('paragraph', { text: 'Início\nImóveis\nSobre\nContato', fontSize: 14, lineHeight: '2' }),
        ]),
        col(4, [
          el('heading', { text: 'Contato', level: 'h4', fontSize: 16, fontWeight: 'bold' }, { paddingBottom: 8 }),
          el('paragraph', { text: 'contato@imobiliaria.com\n(11) 99999-0000', fontSize: 14, lineHeight: '1.8' }, { paddingBottom: 12 }),
          el('whatsapp_button', { label: 'WhatsApp', phoneNumber: '5511999990000', message: 'Olá!', position: 'inline', size: 'sm', showIcon: true }),
        ]),
      ], { gap: 32 })],
      { paddingTop: 48, paddingBottom: 48, bgColor: theme.secondaryColor },
      'Footer',
    ),
});
