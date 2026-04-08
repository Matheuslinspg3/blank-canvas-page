import type { Element } from '@/types/siteBuilderV2';

export function SpacerElement({ element }: { element: Element; isEditing?: boolean }) {
  const height = element.props.height || 32;

  return <div style={{ height: `${height}px` }} className="w-full" />;
}
