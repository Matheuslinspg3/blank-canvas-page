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

export function VideoInspector({ element, onChange }: Props) {
  const { source, url, autoplay, controls, loop, muted, aspectRatio } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Fonte</Label>
        <Select value={source || 'youtube'} onValueChange={(v) => updateProp('source', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="vimeo">Vimeo</SelectItem>
            <SelectItem value="url">URL direta</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">URL</Label>
        <Input className="mt-1" value={url || ''} onChange={(e) => updateProp('url', e.target.value)} placeholder="https://youtube.com/watch?v=..." />
      </div>
      <div>
        <Label className="text-xs">Proporção</Label>
        <Select value={aspectRatio || '16:9'} onValueChange={(v) => updateProp('aspectRatio', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9</SelectItem>
            <SelectItem value="4:3">4:3</SelectItem>
            <SelectItem value="1:1">1:1</SelectItem>
            <SelectItem value="21:9">21:9</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><Label className="text-xs">Autoplay</Label><Switch checked={!!autoplay} onCheckedChange={(v) => updateProp('autoplay', v)} /></div>
        <div className="flex items-center justify-between"><Label className="text-xs">Controles</Label><Switch checked={controls !== false} onCheckedChange={(v) => updateProp('controls', v)} /></div>
        <div className="flex items-center justify-between"><Label className="text-xs">Loop</Label><Switch checked={!!loop} onCheckedChange={(v) => updateProp('loop', v)} /></div>
        <div className="flex items-center justify-between"><Label className="text-xs">Mudo</Label><Switch checked={!!muted} onCheckedChange={(v) => updateProp('muted', v)} /></div>
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
