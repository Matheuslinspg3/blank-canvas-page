import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { Home } from 'lucide-react';

export function PropertyCardElement({ element }: { element: Element; isEditing?: boolean }) {
  const { variant } = element.props;

  return (
    <ElementWrapper element={element}>
      <div className={`border rounded-lg overflow-hidden ${variant === 'horizontal' ? 'flex' : ''}`}>
        <div className={`bg-muted flex items-center justify-center ${variant === 'horizontal' ? 'w-48 h-32' : 'w-full h-48'}`}>
          <Home className="w-8 h-8 text-muted-foreground" />
        </div>
        <div className="p-4">
          <h4 className="font-semibold">Imóvel de exemplo</h4>
          <p className="text-sm text-muted-foreground">3 quartos · 120m² · Centro</p>
          <p className="font-bold mt-2">R$ 450.000</p>
        </div>
      </div>
    </ElementWrapper>
  );
}
