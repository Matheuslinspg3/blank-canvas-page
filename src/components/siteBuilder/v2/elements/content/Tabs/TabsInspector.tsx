import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Props { element: Element; onChange: (props: any, styles?: ElementStyles) => void; }

export function TabsInspector({ element, onChange }: Props) {
  const tabs: { label: string; content: string }[] = element.props.tabs || [{ label: 'Tab 1', content: 'Conteúdo 1' }];
  const updateTabs = (newTabs: typeof tabs) => onChange({ ...element.props, tabs: newTabs });

  return (
    <div className="space-y-3">
      {tabs.map((t, i) => (
        <div key={i} className="border rounded p-2 space-y-2">
          <div className="flex items-center gap-2">
            <Input className="flex-1 h-7 text-xs" value={t.label} onChange={(e) => { const n = [...tabs]; n[i] = { ...t, label: e.target.value }; updateTabs(n); }} placeholder="Título da aba" />
            <button onClick={() => updateTabs(tabs.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <Textarea className="text-xs min-h-[60px]" value={t.content} onChange={(e) => { const n = [...tabs]; n[i] = { ...t, content: e.target.value }; updateTabs(n); }} />
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => updateTabs([...tabs, { label: `Tab ${tabs.length + 1}`, content: '' }])}><Plus className="w-3.5 h-3.5 mr-1" />Adicionar aba</Button>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
