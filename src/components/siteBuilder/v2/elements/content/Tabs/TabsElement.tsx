import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { useState } from 'react';

export function TabsElement({ element }: { element: Element; isEditing?: boolean }) {
  const { tabs } = element.props;
  const items: { label: string; content: string }[] = tabs || [{ label: 'Tab 1', content: 'Conteúdo 1' }];
  const [active, setActive] = useState(0);

  return (
    <ElementWrapper element={element}>
      <div className="flex border-b gap-1">
        {items.map((t, i) => (
          <button
            key={i}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${i === active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActive(i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-4 text-sm">{items[active]?.content}</div>
    </ElementWrapper>
  );
}
