import type { ComponentType } from 'react';
import type { BlockType, BlockVariant, Block, SiteTheme } from '@/types/siteBuilder';

export interface BlockDefinition<T extends Block = Block> {
  label: string;
  icon: ComponentType;
  defaultProps: T['props'];
  Component: ComponentType<{ block: T; theme: SiteTheme }>;
  Inspector: ComponentType<{ block: T; onChange: (props: T['props']) => void }>;
}

// Skeleton — will be populated in PHASE 2 with actual block components
export const BlockRegistry: Record<
  BlockType,
  Partial<Record<BlockVariant, BlockDefinition>>
> = {
  hero: {},
  property_grid: {},
  property_carousel: {},
  about: {},
  contact: {},
  whatsapp_cta: {},
  footer: {},
};
