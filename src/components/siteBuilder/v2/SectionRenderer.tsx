import type { Section, Row, Column, Element as V2Element } from '@/types/siteBuilderV2';
import type { SiteTheme } from '@/types/siteBuilder';
import { ElementRegistry } from './elementRegistry';
import { CSSProperties, useMemo, useEffect, useState } from 'react';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);
  return isMobile;
}

function ElementRenderer({ element, isEditing }: { element: V2Element; isEditing?: boolean }) {
  const def = ElementRegistry[element.type];
  if (!def) return <div className="p-2 text-xs text-destructive border border-destructive rounded">Elemento desconhecido: {element.type}</div>;
  const Comp = def.Component;
  return <Comp element={element} isEditing={isEditing} />;
}

function ColumnRenderer({ column, isMobile, isEditing }: { column: Column; isMobile: boolean; isEditing?: boolean }) {
  const style: CSSProperties = useMemo(() => ({
    gridColumn: isMobile ? undefined : `span ${column.width} / span ${column.width}`,
    paddingTop: column.styles.paddingTop ?? 0,
    paddingRight: column.styles.paddingRight ?? 0,
    paddingBottom: column.styles.paddingBottom ?? 0,
    paddingLeft: column.styles.paddingLeft ?? 0,
    backgroundColor: column.styles.bgColor || undefined,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: column.styles.verticalAlign === 'center' ? 'center' : column.styles.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
  }), [column, isMobile]);

  return (
    <div style={style}>
      {column.elements.map((el) => (
        <ElementRenderer key={el.id} element={el} isEditing={isEditing} />
      ))}
    </div>
  );
}

function RowRenderer({ row, isMobile, isEditing }: { row: Row; isMobile: boolean; isEditing?: boolean }) {
  const style: CSSProperties = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, minmax(0, 1fr))',
    gap: row.styles.gap ?? 16,
    marginTop: row.styles.marginTop ?? 0,
    marginBottom: row.styles.marginBottom ?? 0,
  }), [row, isMobile]);

  return (
    <div style={style}>
      {row.columns.map((col) => (
        <ColumnRenderer key={col.id} column={col} isMobile={isMobile} isEditing={isEditing} />
      ))}
    </div>
  );
}

interface SectionRendererProps {
  section: Section;
  theme: SiteTheme;
  properties?: any[];
  isEditing?: boolean;
}

export function SectionRenderer({ section, theme, properties, isEditing }: SectionRendererProps) {
  const isMobile = useIsMobile();

  if (!section.visible && !isEditing) return null;

  const sectionStyle: CSSProperties = useMemo(() => {
    const s: CSSProperties = {
      paddingTop: section.styles.paddingTop ?? 0,
      paddingBottom: section.styles.paddingBottom ?? 0,
      minHeight: section.styles.minHeight || undefined,
      fontFamily: theme.fontFamily || undefined,
    };
    if (section.styles.bgColor) s.backgroundColor = section.styles.bgColor;
    if (section.styles.bgImage) {
      s.backgroundImage = `url(${section.styles.bgImage})`;
      s.backgroundSize = 'cover';
      s.backgroundPosition = 'center';
    }
    if (section.styles.bgGradient) {
      s.backgroundImage = section.styles.bgGradient;
    }
    return s;
  }, [section, theme]);

  const content = (
    <>
      {section.rows.map((row) => (
        <RowRenderer key={row.id} row={row} isMobile={isMobile} isEditing={isEditing} />
      ))}
    </>
  );

  return (
    <section
      style={sectionStyle}
      className={`relative ${!section.visible && isEditing ? 'opacity-30' : ''}`}
    >
      {!section.visible && isEditing && (
        <div className="absolute top-2 right-2 bg-muted text-muted-foreground text-xs px-2 py-1 rounded z-10">
          Oculto
        </div>
      )}
      {section.styles.fullWidth ? content : (
        <div className="max-w-7xl mx-auto px-4">{content}</div>
      )}
    </section>
  );
}
