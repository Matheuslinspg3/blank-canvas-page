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

export function ImageInspector({ element, onChange }: Props) {
  const { src, alt, objectFit, link, openInNewTab, maxHeight } = element.props;
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">URL da imagem</Label>
        <Input className="mt-1" value={src || ''} onChange={(e) => updateProp('src', e.target.value)} placeholder="https://..." />
      </div>
      <div>
        <Label className="text-xs">Texto alternativo</Label>
        <Input className="mt-1" value={alt || ''} onChange={(e) => updateProp('alt', e.target.value)} />
      </div>
      <div>
        <Label className="text-xs">Ajuste da imagem</Label>
        <Select value={objectFit || 'cover'} onValueChange={(v) => updateProp('objectFit', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">Cover</SelectItem>
            <SelectItem value="contain">Contain</SelectItem>
            <SelectItem value="fill">Fill</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Altura máxima (px)</Label>
        <Input type="number" className="mt-1" value={maxHeight || ''} onChange={(e) => updateProp('maxHeight', Number(e.target.value) || undefined)} placeholder="Automática" />
      </div>
      <div>
        <Label className="text-xs">Link</Label>
        <Input className="mt-1" value={link || ''} onChange={(e) => updateProp('link', e.target.value)} placeholder="https://..." />
      </div>
      {link && (
        <div className="flex items-center justify-between">
          <Label className="text-xs">Abrir em nova aba</Label>
          <Switch checked={!!openInNewTab} onCheckedChange={(v) => updateProp('openInNewTab', v)} />
        </div>
      )}
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
