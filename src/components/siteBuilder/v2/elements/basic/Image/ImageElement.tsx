import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { ImageIcon } from 'lucide-react';

export function ImageElement({ element }: { element: Element; isEditing?: boolean }) {
  const { src, alt, objectFit, maxHeight, link } = element.props;

  const img = src ? (
    <img
      src={src}
      alt={alt || ''}
      style={{ objectFit: objectFit || 'cover', maxHeight: maxHeight ? `${maxHeight}px` : undefined }}
      className="w-full"
    />
  ) : (
    <div className="w-full h-48 bg-muted flex items-center justify-center rounded">
      <ImageIcon className="w-12 h-12 text-muted-foreground" />
    </div>
  );

  return (
    <ElementWrapper element={element}>
      {link && !element.props.isEditing ? <a href={link} target={element.props.openInNewTab ? '_blank' : undefined} rel="noopener noreferrer">{img}</a> : img}
    </ElementWrapper>
  );
}
