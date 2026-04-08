// ── Block types ──────────────────────────────────────────────
export type BlockType =
  | 'hero'
  | 'property_grid'
  | 'property_carousel'
  | 'about'
  | 'contact'
  | 'whatsapp_cta'
  | 'footer';

export type BlockVariant = 'A' | 'B' | 'C';

export interface BaseBlock {
  id: string;
  type: BlockType;
  variant: BlockVariant;
  visible: boolean;
  order: number;
}

// ── Hero ─────────────────────────────────────────────────────
export interface HeroABlock extends BaseBlock {
  type: 'hero';
  variant: 'A';
  props: {
    title: string;
    subtitle: string;
    bgImage: string;
    ctaLabel: string;
    ctaHref: string;
    bgColor: string;
    textColor: string;
  };
}

export interface HeroBBlock extends BaseBlock {
  type: 'hero';
  variant: 'B';
  props: {
    title: string;
    subtitle: string;
    image: string;
    ctaLabel: string;
    ctaHref: string;
    bgColor: string;
    textColor: string;
  };
}

// ── Property Grid ────────────────────────────────────────────
export interface PropertyGridABlock extends BaseBlock {
  type: 'property_grid';
  variant: 'A';
  props: {
    title: string;
    subtitle: string;
    columns: 2 | 3 | 4;
    maxItems: number;
    showFilters: boolean;
  };
}

export interface PropertyGridBBlock extends BaseBlock {
  type: 'property_grid';
  variant: 'B';
  props: {
    title: string;
    subtitle: string;
    columns: 2 | 3;
    maxItems: number;
    cardStyle: 'rounded' | 'square';
  };
}

// ── Property Carousel ────────────────────────────────────────
export interface PropertyCarouselABlock extends BaseBlock {
  type: 'property_carousel';
  variant: 'A';
  props: {
    title: string;
    subtitle: string;
    maxItems: number;
    autoplay: boolean;
    interval: number;
  };
}

// ── About ────────────────────────────────────────────────────
export interface AboutABlock extends BaseBlock {
  type: 'about';
  variant: 'A';
  props: {
    title: string;
    text: string;
    image: string;
    imagePosition: 'left' | 'right';
  };
}

export interface AboutBBlock extends BaseBlock {
  type: 'about';
  variant: 'B';
  props: {
    title: string;
    text: string;
    bgColor: string;
    textColor: string;
  };
}

// ── Contact ──────────────────────────────────────────────────
export interface ContactABlock extends BaseBlock {
  type: 'contact';
  variant: 'A';
  props: {
    title: string;
    subtitle: string;
    showMap: boolean;
    showForm: boolean;
  };
}

export interface ContactBBlock extends BaseBlock {
  type: 'contact';
  variant: 'B';
  props: {
    title: string;
    subtitle: string;
    bgColor: string;
    layout: 'stacked' | 'side-by-side';
  };
}

// ── WhatsApp CTA ─────────────────────────────────────────────
export interface WhatsappCtaABlock extends BaseBlock {
  type: 'whatsapp_cta';
  variant: 'A';
  props: {
    message: string;
    buttonLabel: string;
    bgColor: string;
    textColor: string;
  };
}

// ── Footer ───────────────────────────────────────────────────
export interface FooterABlock extends BaseBlock {
  type: 'footer';
  variant: 'A';
  props: {
    showSocial: boolean;
    showCredits: boolean;
    bgColor: string;
    textColor: string;
  };
}

export interface FooterBBlock extends BaseBlock {
  type: 'footer';
  variant: 'B';
  props: {
    columns: number;
    showSocial: boolean;
    showNewsletter: boolean;
    bgColor: string;
    textColor: string;
  };
}

// ── Discriminated union ──────────────────────────────────────
export type Block =
  | HeroABlock
  | HeroBBlock
  | PropertyGridABlock
  | PropertyGridBBlock
  | PropertyCarouselABlock
  | AboutABlock
  | AboutBBlock
  | ContactABlock
  | ContactBBlock
  | WhatsappCtaABlock
  | FooterABlock
  | FooterBBlock;

// ── Layout document ──────────────────────────────────────────
export interface SiteTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
}

export interface SiteMeta {
  title: string;
  description: string;
}

export interface SiteLayout {
  version: 1;
  blocks: Block[];
  theme: SiteTheme;
  meta: SiteMeta;
}

export interface SiteDocument {
  id: string;
  organization_id: string;
  draft: SiteLayout;
  published: SiteLayout | null;
  last_published_at: string | null;
  last_saved_at: string;
}
