import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export function FormBuilderElement({ element, isEditing }: { element: Element; isEditing?: boolean }) {
  const { heading, fields, submitLabel } = element.props;
  const items: { id: string; type: string; label: string }[] = fields || [];

  return (
    <ElementWrapper element={element}>
      <div className="space-y-4 max-w-lg">
        {heading && <h3 className="text-lg font-semibold">{heading}</h3>}
        {items.map((f) => (
          <div key={f.id}>
            <label className="text-sm font-medium block mb-1">{f.label}</label>
            {f.type === 'textarea' ? (
              <Textarea disabled={isEditing} placeholder={f.label} />
            ) : (
              <Input disabled={isEditing} type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : 'text'} placeholder={f.label} />
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">Adicione campos no inspector.</p>}
        <Button disabled={isEditing} className="w-full">{submitLabel || 'Enviar'}</Button>
      </div>
    </ElementWrapper>
  );
}
