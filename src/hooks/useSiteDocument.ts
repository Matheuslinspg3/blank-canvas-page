import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SiteDocument, SiteLayout } from '@/types/siteBuilder';

const EMPTY_LAYOUT: SiteLayout = {
  version: 1,
  blocks: [],
  theme: { primaryColor: '#D62828', secondaryColor: '#1E3A5F', accentColor: '#F77F00', fontFamily: 'Inter' },
  meta: { title: '', description: '' },
};

const QUERY_KEY = 'site-document';

// ── Read ──────────────────────────────────────────────────────
export function useSiteDocument(organizationId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SiteDocument> => {
      // Try to fetch existing
      const { data, error } = await supabase
        .from('site_documents')
        .select('*')
        .eq('organization_id', organizationId!)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        return {
          id: data.id,
          organization_id: data.organization_id,
          draft: data.draft as unknown as SiteLayout,
          published: data.published as unknown as SiteLayout | null,
          last_published_at: data.last_published_at,
          last_saved_at: data.last_saved_at,
        };
      }

      // Auto-create empty document
      const { data: created, error: createErr } = await supabase
        .from('site_documents')
        .insert({ organization_id: organizationId!, draft: EMPTY_LAYOUT as unknown as Record<string, unknown> })
        .select('*')
        .single();

      if (createErr) throw createErr;

      return {
        id: created.id,
        organization_id: created.organization_id,
        draft: created.draft as unknown as SiteLayout,
        published: created.published as unknown as SiteLayout | null,
        last_published_at: created.last_published_at,
        last_saved_at: created.last_saved_at,
      };
    },
  });
}

// ── Save draft ────────────────────────────────────────────────
export function useSaveDraft() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: SiteLayout }) => {
      const { error } = await supabase
        .from('site_documents')
        .update({
          draft: draft as unknown as Record<string, unknown>,
          last_saved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ── Publish ───────────────────────────────────────────────────
export function usePublishSite() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: SiteLayout }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('site_documents')
        .update({
          published: draft as unknown as Record<string, unknown>,
          last_published_at: now,
          updated_at: now,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
