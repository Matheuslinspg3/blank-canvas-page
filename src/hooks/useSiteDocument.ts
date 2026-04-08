import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { SiteLayout } from '@/types/siteBuilder';
import type { SiteLayoutV2 } from '@/types/siteBuilderV2';

const EMPTY_LAYOUT: SiteLayout = {
  version: 1,
  blocks: [],
  theme: { primaryColor: '#D62828', secondaryColor: '#1E3A5F', accentColor: '#F77F00', fontFamily: 'Inter' },
  meta: { title: '', description: '' },
};

const QUERY_KEY = 'site-document';

export interface SiteDocument {
  id: string;
  organization_id: string;
  editor_mode: 'simple' | 'advanced';
  draft: SiteLayout | null;
  published: SiteLayout | null;
  draft_v2: SiteLayoutV2 | null;
  published_v2: SiteLayoutV2 | null;
  last_published_at: string | null;
  last_saved_at: string;
}

// ── Read ──────────────────────────────────────────────────────
export function useSiteDocument(organizationId: string | undefined) {
  return useQuery({
    queryKey: [QUERY_KEY, organizationId],
    enabled: !!organizationId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SiteDocument> => {
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
          editor_mode: (data as any).editor_mode ?? 'simple',
          draft: data.draft as unknown as SiteLayout | null,
          published: data.published as unknown as SiteLayout | null,
          draft_v2: (data as any).draft_v2 as SiteLayoutV2 | null,
          published_v2: (data as any).published_v2 as SiteLayoutV2 | null,
          last_published_at: data.last_published_at,
          last_saved_at: data.last_saved_at,
        };
      }

      // Auto-create empty document
      const { data: created, error: createErr } = await supabase
        .from('site_documents')
        .insert([{ organization_id: organizationId!, draft: EMPTY_LAYOUT as unknown as Json }])
        .select('*')
        .single();

      if (createErr) throw createErr;

      return {
        id: created.id,
        organization_id: created.organization_id,
        editor_mode: 'simple',
        draft: created.draft as unknown as SiteLayout,
        published: created.published as unknown as SiteLayout | null,
        draft_v2: null,
        published_v2: null,
        last_published_at: created.last_published_at,
        last_saved_at: created.last_saved_at,
      };
    },
  });
}

// ── Save draft (v1 simple) ───────────────────────────────────
export function useSaveDraft() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: SiteLayout }) => {
      const { error } = await supabase
        .from('site_documents')
        .update({
          draft: draft as unknown as Json,
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

// ── Publish (v1 simple) ──────────────────────────────────────
export function usePublishSite() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: SiteLayout }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('site_documents')
        .update({
          published: draft as unknown as Json,
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

// ── Save draft v2 (advanced) ─────────────────────────────────
export function useSaveDraftV2() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, draft_v2 }: { id: string; draft_v2: SiteLayoutV2 }) => {
      const { error } = await supabase
        .from('site_documents')
        .update({
          draft_v2: draft_v2 as unknown as Json,
          last_saved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ── Publish v2 (advanced) ────────────────────────────────────
export function usePublishSiteV2() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, draft_v2 }: { id: string; draft_v2: SiteLayoutV2 }) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('site_documents')
        .update({
          published_v2: draft_v2 as unknown as Json,
          last_published_at: now,
          updated_at: now,
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

// ── Switch editor mode ───────────────────────────────────────
export function useSwitchEditorMode() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, mode }: { id: string; mode: 'simple' | 'advanced' }) => {
      const { error } = await supabase
        .from('site_documents')
        .update({
          editor_mode: mode,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
