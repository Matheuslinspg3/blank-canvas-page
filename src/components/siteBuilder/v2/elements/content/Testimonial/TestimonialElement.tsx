import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { Star } from 'lucide-react';

export function TestimonialElement({ element }: { element: Element; isEditing?: boolean }) {
  const { quote, authorName, authorRole, rating } = element.props;

  return (
    <ElementWrapper element={element}>
      <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground">
        "{quote || 'Depoimento do cliente aqui.'}"
      </blockquote>
      {(rating ?? 5) > 0 && (
        <div className="flex gap-0.5 mt-2">
          {Array.from({ length: rating || 5 }).map((_, i) => (
            <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
      )}
      <div className="mt-3">
        <p className="font-semibold text-sm">{authorName || 'Cliente'}</p>
        {authorRole && <p className="text-xs text-muted-foreground">{authorRole}</p>}
      </div>
    </ElementWrapper>
  );
}
