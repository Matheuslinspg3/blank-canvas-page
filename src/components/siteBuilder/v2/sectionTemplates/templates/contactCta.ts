import { registerSectionTemplate } from '../registry';
import { section, row, col, el, placeholderThumb } from '../helpers';
import type { SiteTheme } from '@/types/siteBuilder';

registerSectionTemplate({
  id: 'contact-cta',
  label: 'Contato — CTA WhatsApp',
  category: 'contact',
  thumbnail: placeholderThumb('contact', 'Contact CTA'),
  build: (theme: SiteTheme) =>
    section(
      [row([col(12, [
        el('heading', { text: 'Fale conosco agora', level: 'h2', fontSize: 28, fontWeight: 'bold' }, { textAlign: 'center', paddingBottom: 8 }),
        el('paragraph', { text: 'Tire suas dúvidas e agende uma visita pelo WhatsApp.', fontSize: 16 }, { textAlign: 'center', paddingBottom: 24 }),
        el('whatsapp_button', { label: 'Chamar no WhatsApp', phoneNumber: '5511999990000', message: 'Olá! Gostaria de mais informações.', position: 'inline', size: 'lg', showIcon: true }, { textAlign: 'center' }),
      ])])],
      { paddingTop: 64, paddingBottom: 64 },
      'CTA WhatsApp',
    ),
});
