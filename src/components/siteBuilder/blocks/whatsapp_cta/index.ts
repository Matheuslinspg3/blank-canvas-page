import { MessageCircle } from 'lucide-react';
import { BlockRegistry } from '../../blockRegistry';
import { WhatsappCtaA } from './WhatsappCtaA';
import { WhatsappCtaAInspector } from './WhatsappCtaAInspector';

BlockRegistry.whatsapp_cta.A = {
  label: 'WhatsApp — Chamada para ação',
  icon: MessageCircle,
  defaultProps: { message: 'Quer saber mais? Fale conosco pelo WhatsApp!', buttonLabel: 'Chamar no WhatsApp', bgColor: '#25D366', textColor: '#ffffff' },
  Component: WhatsappCtaA as any,
  Inspector: WhatsappCtaAInspector as any,
};
