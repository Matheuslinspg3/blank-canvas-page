import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../ElementWrapper';

export function Heading({ element }: { element: Element; isEditing?: boolean }) {
  const { text, level, color, fontFamily, fontSize, fontWeight } = element.props;
  const Tag = (level || 'h2') as keyof JSX.IntrinsicElements;

  return (
    <ElementWrapper element={element}>
      <Tag
        style={{
          color: color || 'inherit',
          fontFamily: fontFamily || 'inherit',
          fontSize: fontSize ? `${fontSize}px` : undefined,
          fontWeight: fontWeight || 'bold',
        }}
      >
        {text || 'Título'}
      </Tag>
    </ElementWrapper>
  );
}
