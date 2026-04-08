import { useMemo } from 'react';
import { BlockRegistry } from '@/components/siteBuilder/blockRegistry';
import { MOCK_PROPERTIES } from '@/lib/siteBuilder/mockProperties';
import type { Block, SiteTheme } from '@/types/siteBuilder';
import type { SiteBuilderAction } from '@/hooks/useSiteBuilderState';

interface Props {
  blocks: Block[];
  theme: SiteTheme;
  selectedBlockId: string | null;
  viewport: 'desktop' | 'mobile';
  dispatch: React.Dispatch<SiteBuilderAction>;
}

export function BuilderPreview({ blocks, theme, selectedBlockId, viewport, dispatch }: Props) {
  const sorted = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks]);

  return (
    <div className="h-full overflow-auto bg-muted/50 p-4">
      <div
        className={`mx-auto min-h-full bg-white shadow-lg transition-all ${
          viewport === 'mobile' ? 'w-[390px] rounded-2xl border' : 'max-w-full'
        }`}
      >
        {sorted.map((block) => {
          const def = BlockRegistry[block.type]?.[block.variant];
          if (!def) return null;
          const Component = def.Component as any;
          const isProperty = ['property_grid', 'property_carousel'].includes(block.type);
          const isSelected = block.id === selectedBlockId;

          return (
            <div
              key={block.id}
              className={`relative cursor-pointer transition-all ${
                !block.visible ? 'opacity-30' : ''
              } ${isSelected ? 'outline outline-2 outline-primary outline-offset-2 rounded' : ''}`}
              onClick={() => dispatch({ type: 'SELECT_BLOCK', id: block.id })}
            >
              {!block.visible && (
                <div className="absolute top-2 right-2 z-10 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  Oculto
                </div>
              )}
              <Component
                block={block}
                theme={theme}
                {...(isProperty ? { properties: MOCK_PROPERTIES } : {})}
              />
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Adicione blocos na sidebar esquerda
          </div>
        )}
      </div>
    </div>
  );
}
