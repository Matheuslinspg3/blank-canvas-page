import type { Element } from '@/types/siteBuilderV2';
import { ElementWrapper } from '../../../ElementWrapper';
import { useEffect, useRef, useState } from 'react';

export function CounterElement({ element }: { element: Element; isEditing?: boolean }) {
  const { value, label, prefix, suffix, animationDuration } = element.props;
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const target = value || 0;
  const duration = animationDuration || 2000;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const start = performance.now();
        const animate = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          setCount(Math.floor(progress * target));
          if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);

  return (
    <ElementWrapper element={element}>
      <div ref={ref} className="text-center">
        <p className="text-4xl font-bold">{prefix}{count}{suffix}</p>
        {label && <p className="text-sm text-muted-foreground mt-1">{label}</p>}
      </div>
    </ElementWrapper>
  );
}
