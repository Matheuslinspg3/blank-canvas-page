import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { Mail } from 'lucide-react';
import { ContactFormElement } from './ContactFormElement';
import { ContactFormInspector } from './ContactFormInspector';

registerElement({
  type: 'contact_form',
  label: 'Formulário de Contato',
  category: 'media',
  icon: Mail,
  defaultProps: { heading: 'Entre em contato', fields: { name: true, email: true, phone: true, message: true }, submitLabel: 'Enviar', successMessage: 'Obrigado pelo contato!', sendToEmail: '' },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: ContactFormElement,
  Inspector: ContactFormInspector,
});
