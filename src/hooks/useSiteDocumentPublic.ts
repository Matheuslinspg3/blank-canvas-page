import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SiteLayout } from '@/types/siteBuilder';

/**
 * Fetches the published site document for a given org (anonymous access).
 * Returns null if the org hasn't published via the new site builder yet.
 */
export function useSiteDocumentPublic(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['site-document-public', organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_public_site_document', {
        p_org_id: organizationId!,
      });

      if (error) throw error;

      // RPC returns the jsonb `published` column directly — null if not published
      if (!data) return null;

      const layout = data as SiteLayout;
      if (!layout.blocks || layout.blocks.length === 0) return null;

      return layout;
    },
  });
}
