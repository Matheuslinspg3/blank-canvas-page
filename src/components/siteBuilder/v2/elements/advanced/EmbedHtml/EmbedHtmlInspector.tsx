import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props { element: Element; onChange: (props: any, styles?: ElementStyles) => void; }

export function EmbedHtmlInspector({ element, onChange }: Props) {
  const { html, height } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">HTML</Label>
        <Textarea className="mt-1 min-h-[150px] font-mono text-xs" value={html || ''} onChange={(e) => updateProp('html', e.target.value)} placeholder="<div>...</div>" />
        <p className="text-[10px] text-muted-foreground mt-1">O HTML é sanitizado com DOMPurify antes de renderizar.</p>
      </div>
      <div>
        <Label className="text-xs">Altura mínima (px)</Label>
        <Input type="number" className="mt-1" value={height || ''} onChange={(e) => updateProp('height', Number(e.target.value) || undefined)} placeholder="Auto" />
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
