import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2 } from 'lucide-react';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props { element: Element; onChange: (props: any, styles?: ElementStyles) => void; }

export function AccordionInspector({ element, onChange }: Props) {
  const items: { question: string; answer: string }[] = element.props.items || [];
  const updateItems = (newItems: typeof items) => onChange({ ...element.props, items: newItems });
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Permitir múltiplos abertos</Label>
        <Switch checked={!!element.props.allowMultiple} onCheckedChange={(v) => updateProp('allowMultiple', v)} />
      </div>
      {items.map((item, i) => (
        <div key={i} className="border rounded p-2 space-y-2">
          <div className="flex items-center gap-2">
            <Input className="flex-1 h-7 text-xs" value={item.question} onChange={(e) => { const n = [...items]; n[i] = { ...item, question: e.target.value }; updateItems(n); }} placeholder="Pergunta" />
            <button onClick={() => updateItems(items.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <Textarea className="text-xs min-h-[50px]" value={item.answer} onChange={(e) => { const n = [...items]; n[i] = { ...item, answer: e.target.value }; updateItems(n); }} placeholder="Resposta" />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => updateItems([...items, { question: 'Nova pergunta', answer: 'Resposta aqui.' }])}><Plus className="w-3.5 h-3.5 mr-1" />Adicionar item</Button>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
