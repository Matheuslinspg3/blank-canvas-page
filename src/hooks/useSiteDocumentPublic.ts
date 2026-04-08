import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SiteLayout } from '@/types/siteBuilder';
import type { SiteLayoutV2 } from '@/types/siteBuilderV2';

export interface PublicSiteDocument {
  editor_mode: 'simple' | 'advanced';
  layout: SiteLayout | SiteLayoutV2 | null;
}

export function useSiteDocumentPublic(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['site-document-public', organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PublicSiteDocument | null> => {
      const { data, error } = await supabase.rpc('get_public_site_document_full', {
        p_org_id: organizationId!,
      });

      if (error) throw error;
      if (!data) return null;

      const parsed = data as unknown as { editor_mode: string; layout: any };
      return {
        editor_mode: (parsed.editor_mode || 'simple') as 'simple' | 'advanced',
        layout: parsed.layout ?? null,
      };
    },
  });
}
