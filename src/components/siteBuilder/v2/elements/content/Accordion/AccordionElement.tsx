import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function AccordionElement({ element }: { element: Element; isEditing?: boolean }) {
  const items: { question: string; answer: string }[] = element.props.items || [];
  const allowMultiple = element.props.allowMultiple ?? false;
  const [open, setOpen] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setOpen((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <ElementWrapper element={element}>
      <div className="divide-y">
        {items.map((item, i) => (
          <div key={i}>
            <button className="w-full flex items-center justify-between py-3 text-left font-medium text-sm" onClick={() => toggle(i)}>
              {item.question}
              <ChevronDown className={`w-4 h-4 transition-transform ${open.has(i) ? 'rotate-180' : ''}`} />
            </button>
            {open.has(i) && <div className="pb-3 text-sm text-muted-foreground">{item.answer}</div>}
          </div>
        ))}
      </div>
    </ElementWrapper>
  );
}
