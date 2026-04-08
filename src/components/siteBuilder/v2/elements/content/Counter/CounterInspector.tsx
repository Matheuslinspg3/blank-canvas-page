import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props { element: Element; onChange: (props: any, styles?: ElementStyles) => void; }

export function CounterInspector({ element, onChange }: Props) {
  const { value, label, prefix, suffix, animationDuration } = element.props;
  const updateProp = (key: string, val: any) => onChange({ ...element.props, [key]: val });

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Valor</Label><Input type="number" className="mt-1" value={value || 0} onChange={(e) => updateProp('value', Number(e.target.value))} /></div>
      <div><Label className="text-xs">Rótulo</Label><Input className="mt-1" value={label || ''} onChange={(e) => updateProp('label', e.target.value)} placeholder="Imóveis vendidos" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Prefixo</Label><Input className="mt-1" value={prefix || ''} onChange={(e) => updateProp('prefix', e.target.value)} placeholder="R$ " /></div>
        <div><Label className="text-xs">Sufixo</Label><Input className="mt-1" value={suffix || ''} onChange={(e) => updateProp('suffix', e.target.value)} placeholder="+" /></div>
      </div>
      <div><Label className="text-xs">Duração (ms)</Label><Input type="number" className="mt-1" value={animationDuration || 2000} onChange={(e) => updateProp('animationDuration', Number(e.target.value))} /></div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
