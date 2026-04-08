import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Item { year: string; title: string; description: string; icon?: string }
interface Props { element: Element; onChange: (props: any, styles?: ElementStyles) => void; }

export function TimelineInspector({ element, onChange }: Props) {
  const items: Item[] = element.props.items || [];
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });
  const updateItems = (newItems: Item[]) => updateProp('items', newItems);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Orientação</Label>
        <Select value={element.props.orientation || 'vertical'} onValueChange={(v) => updateProp('orientation', v)}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="vertical">Vertical</SelectItem>
            <SelectItem value="horizontal">Horizontal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {items.map((item, i) => (
        <div key={i} className="border rounded p-2 space-y-1">
          <div className="flex gap-1">
            <Input className="w-20 h-7 text-xs" value={item.year} onChange={(e) => { const n = [...items]; n[i] = { ...item, year: e.target.value }; updateItems(n); }} placeholder="Ano" />
            <Input className="flex-1 h-7 text-xs" value={item.title} onChange={(e) => { const n = [...items]; n[i] = { ...item, title: e.target.value }; updateItems(n); }} placeholder="Título" />
            <button onClick={() => updateItems(items.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <Textarea className="text-xs min-h-[40px]" value={item.description} onChange={(e) => { const n = [...items]; n[i] = { ...item, description: e.target.value }; updateItems(n); }} placeholder="Descrição" />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => updateItems([...items, { year: '2024', title: 'Evento', description: '' }])}><Plus className="w-3.5 h-3.5 mr-1" />Item</Button>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
