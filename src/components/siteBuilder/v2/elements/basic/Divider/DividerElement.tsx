import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';

export function DividerElement({ element }: { element: Element; isEditing?: boolean }) {
  const { thickness, color, style, width } = element.props;

  return (
    <ElementWrapper element={element}>
      <hr
        style={{
          borderTopWidth: `${thickness || 1}px`,
          borderTopColor: color || '#e5e7eb',
          borderTopStyle: style || 'solid',
          width: `${width || 100}%`,
          margin: '0 auto',
          border: 'none',
          borderTop: `${thickness || 1}px ${style || 'solid'} ${color || '#e5e7eb'}`,
        }}
      />
    </ElementWrapper>
  );
}
