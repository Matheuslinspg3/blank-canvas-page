import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export function ContactFormElement({ element, isEditing }: { element: Element; isEditing?: boolean }) {
  const { heading, fields, submitLabel } = element.props;
  const f = fields || { name: true, email: true, phone: true, message: true };

  return (
    <ElementWrapper element={element}>
      <div className="space-y-4 max-w-lg">
        {heading && <h3 className="text-lg font-semibold">{heading}</h3>}
        {f.name && <Input placeholder="Nome" disabled={isEditing} />}
        {f.email && <Input placeholder="E-mail" type="email" disabled={isEditing} />}
        {f.phone && <Input placeholder="Telefone" disabled={isEditing} />}
        {f.message && <Textarea placeholder="Mensagem" disabled={isEditing} />}
        <Button disabled={isEditing} className="w-full">{submitLabel || 'Enviar'}</Button>
      </div>
    </ElementWrapper>
  );
}
