import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

export function WhatsAppButtonInspector({ element, onChange }: Props) {
  const { label, phoneNumber, message, size, showIcon } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Texto do botão</Label>
        <Input className="mt-1" value={label || ''} onChange={(e) => updateProp('label', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Número (com DDD)</Label>
        <Input className="mt-1" value={phoneNumber || ''} onChange={(e) => updateProp('phoneNumber', e.target.value)} placeholder="5511999999999" />
      </div>
      <div>
        <Label className="text-xs">Mensagem padrão</Label>
        <Input className="mt-1" value={message || ''} onChange={(e) => updateProp('message', e.target.value)} placeholder="Olá, gostaria de saber mais..." />
      </div>
      <div>
        <Label className="text-xs">Tamanho</Label>
        <Select value={size || 'md'} onValueChange={(v) => updateProp('size', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Pequeno</SelectItem>
            <SelectItem value="md">Médio</SelectItem>
            <SelectItem value="lg">Grande</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Mostrar ícone</Label>
        <Switch checked={showIcon !== false} onCheckedChange={(v) => updateProp('showIcon', v)} />
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
