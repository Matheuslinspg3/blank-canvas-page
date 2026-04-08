import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';

export function TimelineElement({ element }: { element: Element; isEditing?: boolean }) {
  const { items, orientation } = element.props;
  const list: { year: string; title: string; description: string }[] = items || [];

  return (
    <ElementWrapper element={element}>
      <div className={`relative ${orientation === 'horizontal' ? 'flex gap-8 overflow-x-auto' : 'space-y-6 pl-6 border-l-2 border-primary/30'}`}>
        {list.map((item, i) => (
          <div key={i} className={orientation === 'horizontal' ? 'flex-shrink-0 w-48' : 'relative'}>
            {orientation !== 'horizontal' && (
              <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-primary" />
            )}
            <p className="text-xs font-bold text-primary">{item.year}</p>
            <p className="font-semibold text-sm">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
    </ElementWrapper>
  );
}
