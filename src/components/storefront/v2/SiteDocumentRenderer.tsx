import '@/components/siteBuilder/blocks'; // ensure registry is populated
import { BlockRegistry } from '@/components/siteBuilder/blockRegistry';
import type { SiteLayout, PropertySummary } from '@/types/siteBuilder';

interface Props {
  siteLayout: SiteLayout;
  properties: PropertySummary[];
}

export function SiteDocumentRenderer({ siteLayout, properties }: Props) {
  const { blocks, theme } = siteLayout;
  const visibleBlocks = [...blocks]
    .filter((b) => b.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <div style={{ fontFamily: theme.fontFamily || 'Inter, sans-serif' }}>
      {visibleBlocks.map((block) => {
        const def = BlockRegistry[block.type]?.[block.variant];
        if (!def) return null;
        const Component = def.Component as any;
        const isProperty = ['property_grid', 'property_carousel'].includes(block.type);

        return (
          <Component
            key={block.id}
            block={block}
            theme={theme}
            {...(isProperty ? { properties } : {})}
          />
        );
      })}
    </div>
  );
}
