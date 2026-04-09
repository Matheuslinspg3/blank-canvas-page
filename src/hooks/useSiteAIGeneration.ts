import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SiteLayoutV2, Section, SitePage, NavItem } from '@/types/siteBuilderV2';
import type { SiteTheme } from '@/types/siteBuilder';
import { SectionTemplateRegistry } from '@/components/siteBuilder/v2/sectionTemplates';
import type { AIContentAnswers } from '@/components/settings/AIContentDialog';

// Import templates to ensure registry is populated
import '@/components/siteBuilder/v2/sectionTemplates';

interface AILayoutResponse {
  sections: Array<{
    template_id: string;
    content: {
      heading?: string;
      subheading?: string;
      paragraph?: string;
      button_text?: string;
      button_link?: string;
    };
  }>;
  meta: { title: string; description: string };
  whatsapp_message: string;
  navigation?: Array<{ label: string; href: string; type: 'page' | 'anchor' | 'external' }>;
  pages?: Array<{
    slug: string;
    title: string;
    seo?: { title?: string; description?: string };
    sections: Array<{
      template_id: string;
      content: {
        heading?: string;
        subheading?: string;
        paragraph?: string;
        button_text?: string;
        button_link?: string;
      };
    }>;
  }>;
}

function applyContentToSection(section: Section, content: AILayoutResponse['sections'][0]['content']): Section {
  const updated = JSON.parse(JSON.stringify(section)) as Section;

  for (const row of updated.rows) {
    for (const col of row.columns) {
      for (const el of col.elements) {
        if (el.type === 'heading' && content.heading) {
          el.props.text = content.heading;
        }
        if (el.type === 'paragraph' && content.paragraph) {
          el.props.text = content.paragraph;
        }
        if (el.type === 'button' && content.button_text) {
          el.props.label = content.button_text;
          if (content.button_link) el.props.link = content.button_link;
        }
        // For subheading: look for h2/h3 headings
        if (el.type === 'heading' && content.subheading && (el.props.level === 'h2' || el.props.level === 'h3')) {
          el.props.text = content.subheading;
        }
      }
    }
  }

  return updated;
}

function buildSectionsFromAI(
  aiSections: AILayoutResponse['sections'],
  theme: SiteTheme,
): Section[] {
  const sections: Section[] = [];

  for (let i = 0; i < aiSections.length; i++) {
    const aiSection = aiSections[i];
    const template = SectionTemplateRegistry.find(t => t.id === aiSection.template_id);
    if (!template) continue;

    const built = template.build(theme);
    const withContent = applyContentToSection(built, aiSection.content);
    withContent.order = i;

    // Auto-assign anchor and name based on template_id
    const tid = aiSection.template_id.toLowerCase();
    if (tid.includes('hero')) { withContent.anchor = 'hero'; withContent.name = 'Hero'; }
    else if (tid.includes('about')) { withContent.anchor = 'sobre'; withContent.name = 'Sobre'; }
    else if (tid.includes('propert')) { withContent.anchor = 'imoveis'; withContent.name = 'Imóveis'; }
    else if (tid.includes('contact') || tid.includes('cta')) { withContent.anchor = 'contato'; withContent.name = 'Contato'; }
    else if (tid.includes('footer')) { withContent.anchor = 'rodape'; withContent.name = 'Rodapé'; }
    else if (tid.includes('testimonial')) { withContent.anchor = 'depoimentos'; withContent.name = 'Depoimentos'; }
    else if (tid.includes('banner')) { withContent.anchor = 'banner'; withContent.name = 'Banner'; }

    sections.push(withContent);
  }

  return sections;
}

function buildLayoutFromAI(
  aiLayout: AILayoutResponse,
  theme: SiteTheme,
  siteMode: 'single-page' | 'multi-page' = 'single-page',
): SiteLayoutV2 {
  const sections = buildSectionsFromAI(aiLayout.sections, theme);

  // Fallback if no sections were built
  if (sections.length === 0) {
    const fallbackIds = ['hero-split', 'about-with-image', 'properties-grid', 'footer-three-col'];
    fallbackIds.forEach((tid, i) => {
      const t = SectionTemplateRegistry.find(x => x.id === tid);
      if (t) {
        const s = t.build(theme);
        s.order = i;
        sections.push(s);
      }
    });
  }

  const layout: SiteLayoutV2 = {
    version: 2,
    sections,
    theme,
    meta: aiLayout.meta || { title: '', description: '' },
  };

  // Multi-page: add navigation and pages
  if (siteMode === 'multi-page') {
    // Navigation
    if (aiLayout.navigation && aiLayout.navigation.length > 0) {
      layout.navigation = aiLayout.navigation as NavItem[];
    } else {
      // Default navigation for multi-page
      layout.navigation = [
        { label: 'Home', href: '/', type: 'page' },
        { label: 'Imóveis', href: '/imoveis', type: 'page' },
        { label: 'Sobre', href: '/sobre', type: 'page' },
        { label: 'Contato', href: '/contato', type: 'page' },
      ];
    }

    // Pages
    if (aiLayout.pages && aiLayout.pages.length > 0) {
      layout.pages = aiLayout.pages.map((p): SitePage => ({
        id: crypto.randomUUID(),
        slug: p.slug,
        title: p.title,
        sections: buildSectionsFromAI(p.sections, theme),
        seo: p.seo,
      }));
    } else {
      // Generate default pages structure
      layout.pages = [
        {
          id: crypto.randomUUID(),
          slug: 'imoveis',
          title: 'Imóveis',
          sections: [], // /imoveis uses StorefrontPropertiesPage, no sections needed
          seo: { title: `Imóveis — ${aiLayout.meta?.title || ''}`, description: 'Encontre o imóvel ideal.' },
        },
        {
          id: crypto.randomUUID(),
          slug: 'sobre',
          title: 'Sobre',
          sections: buildSectionsFromAI(
            [{ template_id: 'about-with-image', content: { heading: 'Sobre Nós', paragraph: '' } }],
            theme,
          ),
          seo: { title: `Sobre — ${aiLayout.meta?.title || ''}` },
        },
        {
          id: crypto.randomUUID(),
          slug: 'contato',
          title: 'Contato',
          sections: buildSectionsFromAI(
            [{ template_id: 'contact-cta', content: { heading: 'Fale Conosco', paragraph: '' } }],
            theme,
          ),
          seo: { title: `Contato — ${aiLayout.meta?.title || ''}` },
        },
      ];
    }
  }

  return layout;
}

export type SiteMode = 'single-page' | 'multi-page';

export function useSiteAIGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateTextOnly = useCallback(async (answers: AIContentAnswers) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-site-v2', {
        body: { mode: 'text_only', answers },
      });

      if (error) throw new Error(error.message || 'Erro ao gerar conteúdo');
      if (data?.error) throw new Error(data.error);

      toast.success('Conteúdo gerado com sucesso!');
      return data.content as {
        hero_title: string;
        hero_subtitle: string;
        about_text: string;
        meta_title: string;
        meta_description: string;
        whatsapp_message: string;
        cta_text: string;
        cta_subtitle: string;
      };
    } catch (err: any) {
      console.error('generateTextOnly error:', err);
      toast.error(err.message || 'Erro ao gerar conteúdo');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const generateFullLayout = useCallback(async (
    answers: AIContentAnswers,
    siteMode: SiteMode = 'single-page',
  ): Promise<SiteLayoutV2 | null> => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-site-v2', {
        body: { mode: 'full_layout', answers, site_mode: siteMode },
      });

      if (error) throw new Error(error.message || 'Erro ao gerar layout');
      if (data?.error) throw new Error(data.error);

      const layout = buildLayoutFromAI(data.aiLayout, data.theme, siteMode);
      const modeLabel = siteMode === 'multi-page' ? 'Site multi-página' : 'Site';
      toast.success(`${modeLabel} gerado com sucesso! Revise e publique quando quiser.`);
      return layout;
    } catch (err: any) {
      console.error('generateFullLayout error:', err);
      toast.error(err.message || 'Erro ao gerar site');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { isGenerating, generateTextOnly, generateFullLayout };
}
