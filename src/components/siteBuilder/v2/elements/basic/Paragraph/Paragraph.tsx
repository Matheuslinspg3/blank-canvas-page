import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';

export function Paragraph({ element }: { element: Element; isEditing?: boolean }) {
  const { text, color, fontSize, lineHeight } = element.props;

  return (
    <ElementWrapper element={element}>
      <p
        style={{
          color: color || 'inherit',
          fontSize: fontSize ? `${fontSize}px` : undefined,
          lineHeight: lineHeight || undefined,
        }}
      >
        {text || 'Parágrafo de texto. Clique para editar.'}
      </p>
    </ElementWrapper>
  );
}
