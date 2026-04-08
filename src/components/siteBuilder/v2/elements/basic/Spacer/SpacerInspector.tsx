import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props {
  element: Element;
  onChange: (props: any, styles?: ElementStyles) => void;
}

export function SpacerInspector({ element, onChange }: Props) {
  const height = element.props.height || 32;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Altura ({height}px)</Label>
        <Slider className="mt-2" min={8} max={200} step={4} value={[height]} onValueChange={([v]) => updateProp('height', v)} />
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
