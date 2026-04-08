import { registerElement, DEFAULT_STYLES } from '../../../elementRegistry';
import { FileText } from 'lucide-react';
import { FormBuilderElement } from './FormBuilderElement';
import { FormBuilderInspector } from './FormBuilderInspector';

registerElement({
  type: 'form_builder',
  label: 'Formulário Avançado',
  category: 'advanced',
  icon: FileText,
  defaultProps: { heading: 'Formulário', fields: [{ id: '1', type: 'text', label: 'Nome', required: true }, { id: '2', type: 'email', label: 'E-mail', required: true }], submitLabel: 'Enviar', successMessage: 'Enviado com sucesso!', sendToEmail: '', integrations: 'none' },
  defaultStyles: { ...DEFAULT_STYLES },
  Component: FormBuilderElement,
  Inspector: FormBuilderInspector,
});
