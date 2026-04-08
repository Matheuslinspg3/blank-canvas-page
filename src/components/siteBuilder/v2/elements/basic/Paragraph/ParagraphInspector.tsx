import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

export function ParagraphInspector({ element, onChange }: Props) {
  const { text, color, fontSize, lineHeight } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Texto</Label>
        <Textarea className="mt-1 min-h-[100px]" value={text || ''} onChange={(e) => updateProp('text', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Cor</Label>
        <div className="flex gap-2 mt-1">
          <input type="color" value={color || '#000000'} onChange={(e) => updateProp('color', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
          <Input className="flex-1" value={color || ''} onChange={(e) => updateProp('color', e.target.value)} placeholder="inherit" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Tamanho (px)</Label>
          <Input type="number" className="mt-1" value={fontSize || ''} onChange={(e) => updateProp('fontSize', Number(e.target.value) || undefined)} placeholder="Auto" />
        </div>
        <div>
          <Label className="text-xs">Altura da linha</Label>
          <Input className="mt-1" value={lineHeight || ''} onChange={(e) => updateProp('lineHeight', e.target.value)} placeholder="1.6" />
        </div>
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
