import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Img { url: string; alt: string; caption?: string }
interface Props { element: Element; onChange: (props: any, styles?: ElementStyles) => void; }

export function GalleryInspector({ element, onChange }: Props) {
  const { images, layout, columns, gap, lightbox } = element.props;
  const items: Img[] = images || [];
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });
  const updateImages = (imgs: Img[]) => updateProp('images', imgs);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Layout</Label>
        <Select value={layout || 'grid'} onValueChange={(v) => updateProp('layout', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="masonry">Masonry</SelectItem>
            <SelectItem value="carousel">Carrossel</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Colunas</Label><Input type="number" className="mt-1" value={columns || 3} onChange={(e) => updateProp('columns', Number(e.target.value))} /></div>
        <div><Label className="text-xs">Gap (px)</Label><Input type="number" className="mt-1" value={gap || 8} onChange={(e) => updateProp('gap', Number(e.target.value))} /></div>
      </div>
      <div className="flex items-center justify-between"><Label className="text-xs">Lightbox</Label><Switch checked={!!lightbox} onCheckedChange={(v) => updateProp('lightbox', v)} /></div>
      {items.map((img, i) => (
        <div key={i} className="border rounded p-2 space-y-1">
          <div className="flex gap-1">
            <Input className="flex-1 h-7 text-xs" value={img.url} onChange={(e) => { const n = [...items]; n[i] = { ...img, url: e.target.value }; updateImages(n); }} placeholder="URL" />
            <button onClick={() => updateImages(items.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <Input className="h-7 text-xs" value={img.alt} onChange={(e) => { const n = [...items]; n[i] = { ...img, alt: e.target.value }; updateImages(n); }} placeholder="Alt" />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => updateImages([...items, { url: '', alt: '' }])}><Plus className="w-3.5 h-3.5 mr-1" />Imagem</Button>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
