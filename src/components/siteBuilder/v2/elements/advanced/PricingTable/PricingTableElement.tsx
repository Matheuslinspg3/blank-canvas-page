import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { Check } from 'lucide-react';

export function PricingTableElement({ element }: { element: Element; isEditing?: boolean }) {
  const { plans, currency } = element.props;
  const items: { name: string; price: number; period: string; features: string[]; ctaLabel: string; highlighted?: boolean }[] = plans || [];
  const cur = currency || 'R$';

  return (
    <ElementWrapper element={element}>
      <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, 1fr)` }}>
        {items.map((plan, i) => (
          <div key={i} className={`rounded-xl p-6 border ${plan.highlighted ? 'border-primary shadow-lg ring-2 ring-primary/20' : ''}`}>
            <h4 className="font-bold text-lg">{plan.name}</h4>
            <p className="text-3xl font-bold mt-2">{cur} {plan.price}<span className="text-sm font-normal text-muted-foreground">/{plan.period || 'mês'}</span></p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f, j) => (
                <li key={j} className="flex items-center gap-2 text-sm"><Check className="w-4 h-4 text-primary" />{f}</li>
              ))}
            </ul>
            <button className={`mt-6 w-full py-2 rounded-lg font-medium ${plan.highlighted ? 'bg-primary text-primary-foreground' : 'border'}`} disabled={isEditing}>
              {plan.ctaLabel || 'Contratar'}
            </button>
          </div>
        ))}
      </div>
    </ElementWrapper>
  );
}
