import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

export function HeadingInspector({ element, onChange }: Props) {
  const { text, level, color, fontFamily, fontSize, fontWeight } = element.props;

  const updateProp = (key: string, value: any) => {
    onChange({ ...element.props, [key]: value });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Texto</Label>
        <Input className="mt-1" value={text || ''} onChange={(e) => updateProp('text', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Nível</Label>
        <Select value={level || 'h2'} onValueChange={(v) => updateProp('level', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((h) => (
              <SelectItem key={h} value={h}>{h.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Cor</Label>
        <div className="flex gap-2 mt-1">
          <input type="color" value={color || '#000000'} onChange={(e) => updateProp('color', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
          <Input className="flex-1" value={color || ''} onChange={(e) => updateProp('color', e.target.value)} placeholder="inherit" />
        </div>
      </div>
      <div>
        <Label className="text-xs">Fonte</Label>
        <Select value={fontFamily || 'inherit'} onValueChange={(v) => updateProp('fontFamily', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['inherit', 'Inter', 'Montserrat', 'Playfair Display', 'Poppins', 'Lora', 'Outfit', 'Sora'].map((f) => (
              <SelectItem key={f} value={f}>{f === 'inherit' ? 'Do tema' : f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tamanho (px)</Label>
          <Input type="number" className="mt-1" value={fontSize || ''} onChange={(e) => updateProp('fontSize', Number(e.target.value) || undefined)} placeholder="Auto" />
        </div>
        <div>
          <Label className="text-xs">Peso</Label>
          <Select value={String(fontWeight || 'bold')} onValueChange={(v) => updateProp('fontWeight', v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="500">Médio</SelectItem>
              <SelectItem value="600">Semi-bold</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
              <SelectItem value="800">Extra-bold</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
