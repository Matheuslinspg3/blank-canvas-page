import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Field { id: string; type: string; label: string; required: boolean; options?: string[] }
interface Props { element: Element; onChange: (props: any, styles?: ElementStyles) => void; }

export function FormBuilderInspector({ element, onChange }: Props) {
  const { heading, fields, submitLabel, successMessage, sendToEmail } = element.props;
  const items: Field[] = fields || [];
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });
  const updateFields = (f: Field[]) => updateProp('fields', f);

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Título</Label><Input className="mt-1" value={heading || ''} onChange={(e) => updateProp('heading', e.target.value)} /></div>
      {items.map((f, i) => (
        <div key={f.id} className="border rounded p-2 space-y-1.5">
          <div className="flex items-center gap-1">
            <Input className="flex-1 h-7 text-xs" value={f.label} onChange={(e) => { const n = [...items]; n[i] = { ...f, label: e.target.value }; updateFields(n); }} />
            <button onClick={() => updateFields(items.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex gap-1.5">
            <Select value={f.type} onValueChange={(v) => { const n = [...items]; n[i] = { ...f, type: v }; updateFields(n); }}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['text', 'textarea', 'email', 'tel', 'select', 'radio', 'checkbox', 'date'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1"><Label className="text-[10px]">Obrig.</Label><Switch checked={f.required} onCheckedChange={(v) => { const n = [...items]; n[i] = { ...f, required: v }; updateFields(n); }} /></div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => updateFields([...items, { id: crypto.randomUUID(), type: 'text', label: 'Novo campo', required: false }])}><Plus className="w-3.5 h-3.5 mr-1" />Campo</Button>
      <div><Label className="text-xs">Botão</Label><Input className="mt-1" value={submitLabel || ''} onChange={(e) => updateProp('submitLabel', e.target.value)} placeholder="Enviar" /></div>
      <div><Label className="text-xs">Msg sucesso</Label><Input className="mt-1" value={successMessage || ''} onChange={(e) => updateProp('successMessage', e.target.value)} /></div>
      <div><Label className="text-xs">E-mail destino</Label><Input className="mt-1" value={sendToEmail || ''} onChange={(e) => updateProp('sendToEmail', e.target.value)} /></div>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
