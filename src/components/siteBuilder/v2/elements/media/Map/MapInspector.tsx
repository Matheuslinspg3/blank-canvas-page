import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

export function MapInspector({ element, onChange }: Props) {
  const { address, latitude, longitude, zoom, height } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Endereço</Label>
        <Input className="mt-1" value={address || ''} onChange={(e) => updateProp('address', e.target.value)} placeholder="Rua, Cidade, Estado" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Latitude</Label>
          <Input type="number" step="0.001" className="mt-1" value={latitude || ''} onChange={(e) => updateProp('latitude', Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Longitude</Label>
          <Input type="number" step="0.001" className="mt-1" value={longitude || ''} onChange={(e) => updateProp('longitude', Number(e.target.value))} />
        </div>
      </div>
      <div>
        <Label className="text-xs">Zoom ({zoom || 15})</Label>
        <Slider className="mt-2" min={1} max={20} step={1} value={[zoom || 15]} onValueChange={([v]) => updateProp('zoom', v)} />
      </div>
      <div>
        <Label className="text-xs">Altura (px)</Label>
        <Input type="number" className="mt-1" value={height || 300} onChange={(e) => updateProp('height', Number(e.target.value))} />
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
