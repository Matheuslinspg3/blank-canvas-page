import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

export function IconInspector({ element, onChange }: Props) {
  const { iconName, size, color } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Nome do ícone (Lucide)</Label>
        <Input className="mt-1" value={iconName || ''} onChange={(e) => updateProp('iconName', e.target.value)} placeholder="Star, Home, Phone..." />
        <p className="text-[10px] text-muted-foreground mt-1">Use PascalCase: Star, Home, Phone, Mail, MapPin...</p>
      </div>
      <div>
        <Label className="text-xs">Tamanho (px)</Label>
        <Input type="number" className="mt-1" value={size || 32} onChange={(e) => updateProp('size', Number(e.target.value))} />
      </div>
      <div>
        <Label className="text-xs">Cor</Label>
        <div className="flex gap-2 mt-1">
          <input type="color" value={color || '#000000'} onChange={(e) => updateProp('color', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
          <Input className="flex-1" value={color || ''} onChange={(e) => updateProp('color', e.target.value)} placeholder="currentColor" />
        </div>
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
