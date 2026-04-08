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

export function PropertyCarouselInspector({ element, onChange }: Props) {
  const { heading, source, limit, autoplay, autoplayDelay, showArrows, showDots, slidesPerView } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Título</Label>
        <Input className="mt-1" value={heading || ''} onChange={(e) => updateProp('heading', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Fonte</Label>
        <Select value={source || 'all'} onValueChange={(v) => updateProp('source', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="featured">Destaques</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Slides visíveis</Label>
          <Input type="number" className="mt-1" min={1} max={5} value={slidesPerView || 3} onChange={(e) => updateProp('slidesPerView', Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Limite</Label>
          <Input type="number" className="mt-1" value={limit || 9} onChange={(e) => updateProp('limit', Number(e.target.value))} />
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between"><Label className="text-xs">Autoplay</Label><Switch checked={!!autoplay} onCheckedChange={(v) => updateProp('autoplay', v)} /></div>
        {autoplay && (
          <div>
            <Label className="text-xs">Delay (ms)</Label>
            <Input type="number" className="mt-1" value={autoplayDelay || 3000} onChange={(e) => updateProp('autoplayDelay', Number(e.target.value))} />
          </div>
        )}
        <div className="flex items-center justify-between"><Label className="text-xs">Setas</Label><Switch checked={showArrows !== false} onCheckedChange={(v) => updateProp('showArrows', v)} /></div>
        <div className="flex items-center justify-between"><Label className="text-xs">Pontos</Label><Switch checked={showDots !== false} onCheckedChange={(v) => updateProp('showDots', v)} /></div>
      </div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
