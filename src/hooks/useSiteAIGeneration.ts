import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { SiteLayoutV2, Section } from '@/types/siteBuilderV2';
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

function buildLayoutFromAI(
  aiLayout: AILayoutResponse,
  theme: SiteTheme,
): SiteLayoutV2 {
  const sections: Section[] = [];

  for (let i = 0; i < aiLayout.sections.length; i++) {
    const aiSection = aiLayout.sections[i];
    const template = SectionTemplateRegistry.find(t => t.id === aiSection.template_id);
    if (!template) continue;

    const built = template.build(theme);
    const withContent = applyContentToSection(built, aiSection.content);
    withContent.order = i;
    sections.push(withContent);
  }

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

  return {
    version: 2,
    sections,
    theme,
    meta: aiLayout.meta || { title: '', description: '' },
  };
}

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

  const generateFullLayout = useCallback(async (answers: AIContentAnswers): Promise<SiteLayoutV2 | null> => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-site-v2', {
        body: { mode: 'full_layout', answers },
      });

      if (error) throw new Error(error.message || 'Erro ao gerar layout');
      if (data?.error) throw new Error(data.error);

      const layout = buildLayoutFromAI(data.aiLayout, data.theme);
      toast.success('Site gerado com sucesso! Revise e publique quando quiser.');
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
