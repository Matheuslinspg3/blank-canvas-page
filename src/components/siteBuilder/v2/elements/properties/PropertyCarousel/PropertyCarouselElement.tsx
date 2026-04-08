import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { Home, ChevronLeft, ChevronRight } from 'lucide-react';

export function PropertyCarouselElement({ element }: { element: Element; isEditing?: boolean }) {
  const { heading, slidesPerView, showArrows, showDots } = element.props;
  const slides = slidesPerView || 3;

  return (
    <ElementWrapper element={element}>
      {heading && <h3 className="text-xl font-semibold mb-4">{heading}</h3>}
      <div className="relative">
        {showArrows !== false && (
          <>
            <button className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 rounded-full p-1 shadow" disabled>
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 rounded-full p-1 shadow" disabled>
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: slides }).map((_, i) => (
            <div key={i} className="border rounded-lg overflow-hidden flex-shrink-0" style={{ width: `${100 / slides}%` }}>
              <div className="w-full h-32 bg-muted flex items-center justify-center">
                <Home className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="p-3">
                <p className="font-medium text-sm">Imóvel {i + 1}</p>
                <p className="text-xs text-muted-foreground">3 quartos</p>
              </div>
            </div>
          ))}
        </div>
        {showDots !== false && (
          <div className="flex justify-center gap-1.5 mt-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
            ))}
          </div>
        )}
      </div>
    </ElementWrapper>
  );
}
