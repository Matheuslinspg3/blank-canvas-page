import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { ImageIcon } from 'lucide-react';

export function GalleryElement({ element }: { element: Element; isEditing?: boolean }) {
  const { images, layout, columns, gap } = element.props;
  const items: { url: string; alt: string; caption?: string }[] = images || [];
  const cols = columns || 3;
  const g = gap || 8;

  if (items.length === 0) {
    return (
      <ElementWrapper element={element}>
        <div className="w-full h-48 bg-muted rounded flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground ml-2">Galeria vazia</span>
        </div>
      </ElementWrapper>
    );
  }

  return (
    <ElementWrapper element={element}>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: `${g}px` }}>
        {items.map((img, i) => (
          <div key={i} className="rounded overflow-hidden">
            <img src={img.url} alt={img.alt || ''} className="w-full h-48 object-cover" />
            {img.caption && <p className="text-xs text-muted-foreground mt-1 text-center">{img.caption}</p>}
          </div>
        ))}
      </div>
    </ElementWrapper>
  );
}
