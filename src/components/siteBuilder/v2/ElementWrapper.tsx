import type { Element, ElementStyles } from '@/types/siteBuilderV2';
import { CSSProperties, useMemo } from 'react';

const SHADOW_MAP: Record<string, string> = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
};

export function useElementStyles(styles: ElementStyles): CSSProperties {
  return useMemo(() => ({
    paddingTop: styles.paddingTop ?? 0,
    paddingRight: styles.paddingRight ?? 0,
    paddingBottom: styles.paddingBottom ?? 0,
    paddingLeft: styles.paddingLeft ?? 0,
    marginTop: styles.marginTop ?? 0,
    marginBottom: styles.marginBottom ?? 0,
    backgroundColor: styles.bgColor || undefined,
    backgroundImage: styles.bgImage ? `url(${styles.bgImage})` : undefined,
    backgroundSize: styles.bgImage ? 'cover' : undefined,
    backgroundPosition: styles.bgImage ? 'center' : undefined,
    borderRadius: styles.borderRadius ?? 0,
    borderWidth: styles.borderWidth ?? 0,
    borderColor: styles.borderColor || '#e5e7eb',
    borderStyle: styles.borderStyle === 'none' ? undefined : styles.borderStyle,
    boxShadow: SHADOW_MAP[styles.boxShadow || 'none'],
    textAlign: (styles.textAlign as any) || undefined,
  }), [styles]);
}

export function ElementWrapper({ element, children }: { element: Element; children: React.ReactNode }) {
  const style = useElementStyles(element.styles);

  return (
    <div style={style}>
      {children}
    </div>
  );
}
