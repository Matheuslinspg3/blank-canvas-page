import type { SiteLayoutV2, Section } from '@/types/siteBuilderV2';
import type { SiteTheme } from '@/types/siteBuilder';
import { SectionTemplateRegistry } from '@/components/siteBuilder/v2/sectionTemplates';

const DEFAULT_THEME: SiteTheme = {
  primaryColor: '#2563eb',
  secondaryColor: '#1e293b',
  accentColor: '#f59e0b',
  fontFamily: 'Inter',
};

export function buildInitialSiteLayoutV2(theme?: Partial<SiteTheme>): SiteLayoutV2 {
  const mergedTheme: SiteTheme = { ...DEFAULT_THEME, ...theme };
  const templateIds = ['hero-split', 'about-with-image', 'properties-grid', 'cta-banner', 'footer-three-col'];
  const sections: Section[] = [];
  templateIds.forEach((tid, i) => {
    const tmpl = SectionTemplateRegistry.find(t => t.id === tid);
    if (tmpl) {
      const s = tmpl.build(mergedTheme);
      s.order = i;
      sections.push(s);
    }
  });
  return { version: 2, sections, theme: mergedTheme, meta: { title: '', description: '' } };
}
