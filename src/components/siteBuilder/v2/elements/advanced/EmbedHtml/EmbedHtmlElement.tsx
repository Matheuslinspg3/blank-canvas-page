import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import DOMPurify from 'dompurify';

export function EmbedHtmlElement({ element }: { element: Element; isEditing?: boolean }) {
  const { html, height } = element.props;

  if (!html) {
    return (
      <ElementWrapper element={element}>
        <div className="w-full bg-muted rounded p-4 text-center text-sm text-muted-foreground" style={{ minHeight: height || 100 }}>
          HTML embed vazio
        </div>
      </ElementWrapper>
    );
  }

  return (
    <ElementWrapper element={element}>
      <div
        style={{ minHeight: height || undefined }}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
      />
    </ElementWrapper>
  );
}
