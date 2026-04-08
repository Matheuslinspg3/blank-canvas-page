import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { MessageCircle } from 'lucide-react';
import { WhatsAppButtonElement } from './WhatsAppButtonElement';
import { WhatsAppButtonInspector } from './WhatsAppButtonInspector';

registerElement({
  type: 'whatsapp_button',
  label: 'Botão WhatsApp',
  category: 'media',
  icon: MessageCircle,
  defaultProps: { label: 'Fale pelo WhatsApp', phoneNumber: '', message: 'Olá, gostaria de saber mais!', position: 'inline', size: 'md', showIcon: true },
  defaultStyles: { ...DEFAULT_STYLES, textAlign: 'center' },
  Component: WhatsAppButtonElement,
  Inspector: WhatsAppButtonInspector,
});
