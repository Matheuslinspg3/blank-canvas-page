import { Contact, Phone } from 'lucide-react';
import { BlockRegistry } from '../../blockRegistry';
import { ContactA } from './ContactA';
import { ContactAInspector } from './ContactAInspector';
import { ContactB } from './ContactB';
import { ContactBInspector } from './ContactBInspector';

BlockRegistry.contact.A = {
  label: 'Contato — Com formulário',
  icon: Contact,
  defaultProps: { title: 'Fale conosco', subtitle: 'Estamos prontos para ajudar', showMap: false, showForm: true },
  Component: ContactA as any,
  Inspector: ContactAInspector as any,
};

BlockRegistry.contact.B = {
  label: 'Contato — Apenas informações',
  icon: Phone,
  defaultProps: { title: 'Contato', subtitle: '', bgColor: '#ffffff', layout: 'side-by-side' as const },
  Component: ContactB as any,
  Inspector: ContactBInspector as any,
};
