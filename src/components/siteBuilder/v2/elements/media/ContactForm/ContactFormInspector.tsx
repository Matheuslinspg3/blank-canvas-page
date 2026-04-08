import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

export function ContactFormInspector({ element, onChange }: Props) {
  const { heading, fields, submitLabel, successMessage, sendToEmail } = element.props;
  const f = fields || { name: true, email: true, phone: true, message: true };
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });
  const updateField = (field: string, value: boolean) => updateProp('fields', { ...f, [field]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Título</Label>
        <Input className="mt-1" value={heading || ''} onChange={(e) => updateProp('heading', e.target.value)} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium">Campos</p>
        {(['name', 'email', 'phone', 'message'] as const).map((field) => (
          <div key={field} className="flex items-center justify-between">
            <Label className="text-xs capitalize">{field === 'name' ? 'Nome' : field === 'email' ? 'E-mail' : field === 'phone' ? 'Telefone' : 'Mensagem'}</Label>
            <Switch checked={!!f[field]} onCheckedChange={(v) => updateField(field, v)} />
          </div>
        ))}
      </div>
      <div>
        <Label className="text-xs">Texto do botão</Label>
        <Input className="mt-1" value={submitLabel || ''} onChange={(e) => updateProp('submitLabel', e.target.value)} placeholder="Enviar" />
      </div>
      <div>
        <Label className="text-xs">Mensagem de sucesso</Label>
        <Input className="mt-1" value={successMessage || ''} onChange={(e) => updateProp('successMessage', e.target.value)} placeholder="Obrigado pelo contato!" />
      </div>
      <div>
        <Label className="text-xs">E-mail destino</Label>
        <Input className="mt-1" value={sendToEmail || ''} onChange={(e) => updateProp('sendToEmail', e.target.value)} placeholder="email@exemplo.com" />
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
