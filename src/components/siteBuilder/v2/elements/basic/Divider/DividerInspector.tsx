import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

export function DividerInspector({ element, onChange }: Props) {
  const { thickness, color, style, width } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Espessura ({thickness || 1}px)</Label>
        <Slider className="mt-2" min={1} max={10} step={1} value={[thickness || 1]} onValueChange={([v]) => updateProp('thickness', v)} />
      </div>
      <div>
        <Label className="text-xs">Cor</Label>
        <div className="flex gap-2 mt-1">
          <input type="color" value={color || '#e5e7eb'} onChange={(e) => updateProp('color', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
          <Input className="flex-1" value={color || ''} onChange={(e) => updateProp('color', e.target.value)} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Estilo</Label>
        <Select value={style || 'solid'} onValueChange={(v) => updateProp('style', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Sólido</SelectItem>
            <SelectItem value="dashed">Tracejado</SelectItem>
            <SelectItem value="dotted">Pontilhado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Largura ({width || 100}%)</Label>
        <Slider className="mt-2" min={10} max={100} step={5} value={[width || 100]} onValueChange={([v]) => updateProp('width', v)} />
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
