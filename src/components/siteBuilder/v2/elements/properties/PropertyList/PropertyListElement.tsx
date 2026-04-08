import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { LayoutGrid, Home } from 'lucide-react';

export function PropertyListElement({ element }: { element: Element; isEditing?: boolean }) {
  const { heading, columns, limit } = element.props;
  const cols = columns || 3;
  const items = limit || 6;

  return (
    <ElementWrapper element={element}>
      {heading && <h3 className="text-xl font-semibold mb-4">{heading}</h3>}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: Math.min(items, 6) }).map((_, i) => (
          <div key={i} className="border rounded-lg overflow-hidden">
            <div className="w-full h-32 bg-muted flex items-center justify-center">
              <Home className="w-6 h-6 text-muted-foreground" />
            </div>
            <div className="p-3">
              <p className="font-medium text-sm">Imóvel {i + 1}</p>
              <p className="text-xs text-muted-foreground">3 quartos · 120m²</p>
              <p className="font-bold text-sm mt-1">R$ 450.000</p>
            </div>
          </div>
        ))}
      </div>
    </ElementWrapper>
  );
}
