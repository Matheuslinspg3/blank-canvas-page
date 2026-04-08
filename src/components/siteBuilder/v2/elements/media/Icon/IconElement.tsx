import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import * as icons from 'lucide-react';

export function IconElement({ element }: { element: Element; isEditing?: boolean }) {
  const { iconName, size, color } = element.props;
  const LucideIcon = (icons as any)[iconName || 'Star'];

  if (!LucideIcon) {
    return (
      <ElementWrapper element={element}>
        <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">?</div>
      </ElementWrapper>
    );
  }

  return (
    <ElementWrapper element={element}>
      <LucideIcon size={size || 32} color={color || 'currentColor'} />
    </ElementWrapper>
  );
}
