import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props { element: Element; onChange: (props: any, styles?: ElementStyles) => void; }

export function TestimonialInspector({ element, onChange }: Props) {
  const { quote, authorName, authorRole, authorPhoto, rating } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Citação</Label><Textarea className="mt-1" value={quote || ''} onChange={(e) => updateProp('quote', e.target.value)} /></div>
      <div><Label className="text-xs">Nome</Label><Input className="mt-1" value={authorName || ''} onChange={(e) => updateProp('authorName', e.target.value)} /></div>
      <div><Label className="text-xs">Cargo</Label><Input className="mt-1" value={authorRole || ''} onChange={(e) => updateProp('authorRole', e.target.value)} /></div>
      <div><Label className="text-xs">Foto (URL)</Label><Input className="mt-1" value={authorPhoto || ''} onChange={(e) => updateProp('authorPhoto', e.target.value)} /></div>
      <div><Label className="text-xs">Avaliação ({rating || 5}★)</Label><Slider className="mt-2" min={0} max={5} step={1} value={[rating ?? 5]} onValueChange={([v]) => updateProp('rating', v)} /></div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
