import { section, row, col, el, elZero } from '@/components/siteBuilder/v2/sectionTemplates/helpers';
import type { SiteLayoutV2 } from '@/types/siteBuilderV2';
import type { StorefrontOrg, StorefrontBrand, StorefrontWebsite } from '@/hooks/useStorefront';
import type { SiteTemplate } from '@/components/storefront/templates/StorefrontTemplateRenderer';

interface ConvertInput {
  org: StorefrontOrg;
  brand: StorefrontBrand | null;
  website: StorefrontWebsite | null;
  template: SiteTemplate;
}

// ── Template presets ──────────────────────────────────────
interface HeroPreset {
  bgColor?: string;
  bgImage?: string;
  bgGradient?: string;
  textColor: string;
  subtitleColor: string;
  paddingTop: number;
  paddingBottom: number;
  fontSize: number;
  textAlign: 'left' | 'center';
  split: boolean;
}

function getHeroPreset(template: SiteTemplate, primary: string, secondary: string): HeroPreset {
  switch (template) {
    case 'modern':
      return { bgColor: secondary, textColor: '#ffffff', subtitleColor: '#ffffffcc', paddingTop: 100, paddingBottom: 100, fontSize: 44, textAlign: 'left', split: true };
    case 'elegant':
      return { bgGradient: `linear-gradient(135deg, ${secondary} 0%, #1a1a2e 100%)`, textColor: '#ffffff', subtitleColor: '#d4af37', paddingTop: 120, paddingBottom: 120, fontSize: 42, textAlign: 'center', split: false };
    case 'bold':
      return { bgColor: primary, textColor: '#ffffff', subtitleColor: '#ffffffdd', paddingTop: 100, paddingBottom: 100, fontSize: 52, textAlign: 'center', split: false };
    case 'minimal':
      return { bgColor: '#ffffff', textColor: '#111827', subtitleColor: '#6b7280', paddingTop: 80, paddingBottom: 80, fontSize: 36, textAlign: 'center', split: false };
    case 'classic':
    default:
      return { bgGradient: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`, textColor: '#ffffff', subtitleColor: '#ffffffcc', paddingTop: 120, paddingBottom: 120, fontSize: 48, textAlign: 'center', split: false };
  }
}

// ── Build sections ────────────────────────────────────────

function buildHero(website: StorefrontWebsite | null, org: StorefrontOrg, preset: HeroPreset, primary: string): ReturnType<typeof section> {
  const title = website?.hero_title || `Bem-vindo à ${org.name}`;
  const subtitle = website?.hero_subtitle || 'Encontre o imóvel dos seus sonhos';

  const headingEl = el('heading', { text: title, level: 'h1', color: preset.textColor, fontSize: preset.fontSize, fontWeight: 'bold' }, { textAlign: preset.textAlign, paddingBottom: 8 });
  const subtitleEl = el('paragraph', { text: subtitle, color: preset.subtitleColor, fontSize: 18, lineHeight: '1.6' }, { textAlign: preset.textAlign, paddingBottom: 24 });
  const ctaEl = el('button', { label: 'Ver imóveis', link: '#imoveis', variant: 'primary', size: 'lg', bgColor: primary }, { textAlign: preset.textAlign });

  if (preset.split) {
    return section(
      [row([
        col(6, [headingEl, subtitleEl, ctaEl], { verticalAlign: 'center', paddingRight: 32 }),
        col(6, [el('image', { src: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', alt: 'Imóvel', objectFit: 'cover', maxHeight: 400 })]),
      ], { gap: 24 })],
      { paddingTop: preset.paddingTop, paddingBottom: preset.paddingBottom, bgColor: preset.bgColor, bgGradient: preset.bgGradient, fullWidth: true },
      'Hero',
    );
  }

  return section(
    [row([col(12, [headingEl, subtitleEl, ctaEl])])],
    { paddingTop: preset.paddingTop, paddingBottom: preset.paddingBottom, bgColor: preset.bgColor, bgGradient: preset.bgGradient, bgImage: preset.bgImage, fullWidth: true },
    'Hero',
  );
}

function buildAbout(website: StorefrontWebsite | null): ReturnType<typeof section> | null {
  const text = website?.about_text;
  if (!text) return null;
  const s = section(
    [row([col(12, [
      el('heading', { text: 'Sobre nós', level: 'h2', fontSize: 32, fontWeight: 'bold' }, { textAlign: 'center', paddingBottom: 16 }),
      el('paragraph', { text, fontSize: 16, lineHeight: '1.7' }, { textAlign: 'center' }),
    ])])],
    { paddingTop: 64, paddingBottom: 64 },
    'Sobre',
  );
  s.anchor = 'sobre';
  return s;
}

function buildProperties(): ReturnType<typeof section> {
  const s = section(
    [row([col(12, [
      el('heading', { text: 'Nossos imóveis', level: 'h2', fontSize: 32, fontWeight: 'bold' }, { textAlign: 'center', paddingBottom: 24 }),
      el('property_list', { columns: 3, source: 'featured', limit: 6 }),
    ])])],
    { paddingTop: 64, paddingBottom: 64 },
    'Imóveis',
  );
  s.anchor = 'imoveis';
  return s;
}

function buildContact(website: StorefrontWebsite | null, org: StorefrontOrg): ReturnType<typeof section> {
  const leftElements = [
    el('heading', { text: 'Entre em contato', level: 'h2', fontSize: 28, fontWeight: 'bold' }, { paddingBottom: 16 }),
  ];
  if (website?.contact_phone) leftElements.push(el('paragraph', { text: `📞 ${website.contact_phone}`, fontSize: 16 }, { paddingBottom: 8 }));
  if (website?.contact_email) leftElements.push(el('paragraph', { text: `✉️ ${website.contact_email}`, fontSize: 16 }, { paddingBottom: 8 }));
  if (website?.whatsapp_number) leftElements.push(el('whatsapp_button', { number: website.whatsapp_number, message: website.whatsapp_message || 'Olá!', label: 'Falar no WhatsApp' }, { paddingTop: 16 }));

  const s = section(
    [row([
      col(5, leftElements, { verticalAlign: 'center', paddingRight: 24 }),
      col(7, [el('contact_form', { organizationId: org.id })]),
    ], { gap: 24 })],
    { paddingTop: 64, paddingBottom: 64 },
    'Contato',
  );
  s.anchor = 'contato';
  return s;
}

function buildCta(primary: string): ReturnType<typeof section> {
  return section(
    [row([col(12, [
      el('heading', { text: 'Pronto para encontrar seu imóvel?', level: 'h2', fontSize: 32, fontWeight: 'bold', color: '#ffffff' }, { textAlign: 'center', paddingBottom: 16 }),
      el('button', { label: 'Fale conosco', link: '#contato', variant: 'secondary', size: 'lg' }, { textAlign: 'center' }),
    ])])],
    { paddingTop: 64, paddingBottom: 64, bgColor: primary, fullWidth: true },
    'CTA',
  );
}

function buildFooter(org: StorefrontOrg, brand: StorefrontBrand | null, website: StorefrontWebsite | null): ReturnType<typeof section> {
  const col1 = [
    el('heading', { text: org.name, level: 'h3', fontSize: 20, fontWeight: 'bold', color: '#ffffff' }, { paddingBottom: 8 }),
  ];
  if (brand?.tagline) col1.push(el('paragraph', { text: brand.tagline, color: '#ffffffaa', fontSize: 14 }));

  const col2 = [el('heading', { text: 'Contato', level: 'h4', fontSize: 16, fontWeight: 'bold', color: '#ffffff' }, { paddingBottom: 8 })];
  if (website?.contact_phone) col2.push(el('paragraph', { text: website.contact_phone, color: '#ffffffcc', fontSize: 14 }, { paddingBottom: 4 }));
  if (website?.contact_email) col2.push(el('paragraph', { text: website.contact_email, color: '#ffffffcc', fontSize: 14 }));

  const col3 = [el('paragraph', { text: `© ${new Date().getFullYear()} ${org.name}. Todos os direitos reservados.`, color: '#ffffff99', fontSize: 12 }, { textAlign: 'right' })];

  return section(
    [row([col(4, col1), col(4, col2), col(4, col3)], { gap: 24 })],
    { paddingTop: 40, paddingBottom: 40, bgColor: '#1e293b', fullWidth: true },
    'Rodapé',
  );
}

// ── Main converter ────────────────────────────────────────

export function convertLegacyToSiteLayoutV2({ org, brand, website, template }: ConvertInput): SiteLayoutV2 {
  const primary = brand?.primary_color || '#3B82F6';
  const secondary = brand?.secondary_color || '#1E293B';
  const accent = brand?.accent_color || '#F59E0B';
  const fontFamily = brand?.font_family || 'Montserrat';

  const heroPreset = getHeroPreset(template, primary, secondary);

  const sections = [
    buildHero(website, org, heroPreset, primary),
    buildAbout(website),
    buildProperties(),
    buildCta(primary),
    buildContact(website, org),
    buildFooter(org, brand, website),
  ].filter(Boolean) as ReturnType<typeof section>[];

  // Set order
  sections.forEach((s, i) => { s.order = i; });

  return {
    version: 2,
    sections,
    theme: {
      primaryColor: primary,
      secondaryColor: secondary,
      accentColor: accent,
      fontFamily,
    },
    meta: {
      title: website?.meta_title || `${org.name} — Imóveis`,
      description: website?.meta_description || `Confira os melhores imóveis da ${org.name}. Encontre seu imóvel ideal.`,
    },
  };
}
