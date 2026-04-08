import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { CommonStylesEditor } from '../../../CommonStylesEditor';

interface Plan { name: string; price: number; period: string; features: string[]; ctaLabel: string; ctaLink: string; highlighted: boolean }
interface Props { element: Element; onChange: (props: any, styles?: ElementStyles) => void; }

export function PricingTableInspector({ element, onChange }: Props) {
  const plans: Plan[] = element.props.plans || [];
  const updateProp = (key: string, value: any) => onChange({ ...element.props, [key]: value });
  const updatePlans = (p: Plan[]) => updateProp('plans', p);

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Moeda</Label><Input className="mt-1" value={element.props.currency || 'R$'} onChange={(e) => updateProp('currency', e.target.value)} /></div>
      {plans.map((plan, i) => (
        <div key={i} className="border rounded p-2 space-y-1.5">
          <div className="flex gap-1">
            <Input className="flex-1 h-7 text-xs" value={plan.name} onChange={(e) => { const n = [...plans]; n[i] = { ...plan, name: e.target.value }; updatePlans(n); }} placeholder="Nome" />
            <button onClick={() => updatePlans(plans.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex gap-1">
            <Input type="number" className="w-24 h-7 text-xs" value={plan.price} onChange={(e) => { const n = [...plans]; n[i] = { ...plan, price: Number(e.target.value) }; updatePlans(n); }} placeholder="Preço" />
            <Input className="flex-1 h-7 text-xs" value={plan.period} onChange={(e) => { const n = [...plans]; n[i] = { ...plan, period: e.target.value }; updatePlans(n); }} placeholder="mês" />
          </div>
          <Input className="h-7 text-xs" value={plan.features.join(', ')} onChange={(e) => { const n = [...plans]; n[i] = { ...plan, features: e.target.value.split(',').map((s) => s.trim()) }; updatePlans(n); }} placeholder="Feature 1, Feature 2" />
          <div className="flex items-center gap-1"><Label className="text-[10px]">Destaque</Label><Switch checked={plan.highlighted} onCheckedChange={(v) => { const n = [...plans]; n[i] = { ...plan, highlighted: v }; updatePlans(n); }} /></div>
        </div>
      ))}
      <Button variant="outline" size="sm" className="w-full" onClick={() => updatePlans([...plans, { name: 'Plano', price: 99, period: 'mês', features: ['Feature'], ctaLabel: 'Contratar', ctaLink: '#', highlighted: false }])}><Plus className="w-3.5 h-3.5 mr-1" />Plano</Button>
      <CommonStylesEditor styles={element.styles} onChange={(s) => onChange(element.props, s)} />
    </div>
  );
}
