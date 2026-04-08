import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'contact-split',
  label: 'Contato — Dividido',
  category: 'contact',
  thumbnail: placeholderThumb('contact', 'Contact Split'),
  build: (theme: SiteTheme) =>
    section(
      [row([
        col(6, [
          el('contact_form', { heading: 'Entre em contato', fields: { name: true, email: true, phone: true, message: true }, submitLabel: 'Enviar', successMessage: 'Mensagem enviada!' }),
        ]),
        col(6, [
          el('map', { address: 'São Paulo, SP', latitude: -23.5505, longitude: -46.6333, zoom: 14, height: 250, showMarker: true }),
          el('paragraph', { text: 'Rua Exemplo, 123 — Centro, São Paulo/SP\nTelefone: (11) 99999-0000', fontSize: 14, lineHeight: '1.6' }, { paddingTop: 16 }),
        ]),
      ], { gap: 32 })],
      { paddingTop: 64, paddingBottom: 64 },
      'Contato',
    ),
});
