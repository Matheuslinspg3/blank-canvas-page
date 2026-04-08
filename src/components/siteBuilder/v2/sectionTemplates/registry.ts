import type { Section } from '@/types/siteBuilderV2';
import type { SiteTheme } from '@/types/siteBuilder';

export interface SectionTemplate {
  id: string;
  label: string;
  category: 'hero' | 'about' | 'properties' | 'contact' | 'cta' | 'footer' | 'custom';
  thumbnail: string;
  description?: string;
  build: (theme: SiteTheme) => Section;
}

export const SectionTemplateRegistry: SectionTemplate[] = [];

export function registerSectionTemplate(t: SectionTemplate) {
  SectionTemplateRegistry.push(t);
}
