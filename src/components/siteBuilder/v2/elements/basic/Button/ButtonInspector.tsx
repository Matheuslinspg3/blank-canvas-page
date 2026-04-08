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

export function ButtonInspector({ element, onChange }: Props) {
  const { label, link, variant, size, openInNewTab, fullWidth } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Texto do botão</Label>
        <Input className="mt-1" value={label || ''} onChange={(e) => updateProp('label', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Link</Label>
        <Input className="mt-1" value={link || ''} onChange={(e) => updateProp('link', e.target.value)} placeholder="https://..." />
      </div>
      <div>
        <Label className="text-xs">Variante</Label>
        <Select value={variant || 'primary'} onValueChange={(v) => updateProp('variant', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="primary">Primário</SelectItem>
            <SelectItem value="secondary">Secundário</SelectItem>
            <SelectItem value="outline">Contorno</SelectItem>
            <SelectItem value="ghost">Fantasma</SelectItem>
          </SelectContent>
        </Select>
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
        <Label className="text-xs">Largura total</Label>
        <Switch checked={!!fullWidth} onCheckedChange={(v) => updateProp('fullWidth', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Abrir em nova aba</Label>
        <Switch checked={!!openInNewTab} onCheckedChange={(v) => updateProp('openInNewTab', v)} />
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
