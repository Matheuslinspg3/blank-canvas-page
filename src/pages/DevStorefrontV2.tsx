import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSiteDocumentPublic } from '@/hooks/useSiteDocumentPublic';
import { SiteDocumentRendererV2 } from '@/components/storefront/v3/SiteDocumentRendererV2';
import type { SiteLayoutV2 } from '@/types/siteBuilderV2';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

const DEFAULT_ORG_ID = 'cdf3f0e6-da64-4090-bc76-1758796bea28';

export default function DevStorefrontV2() {
  const [params] = useSearchParams();
  const orgId = params.get('orgId') || DEFAULT_ORG_ID;
  const queryClient = useQueryClient();
  const [publishing, setPublishing] = useState(false);

  const { data: siteDoc, isLoading: loadingSite, error: siteError } = useSiteDocumentPublic(orgId);

  const { data: properties = [] } = useQuery({
    queryKey: ['dev-storefront-v2-properties', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('marketplace_properties_public' as any)
        .select('*')
        .eq('organization_id', orgId)
        .limit(50);
      return (data as any[]) || [];
    },
  });

  const layout = siteDoc?.layout as SiteLayoutV2 | null;
  const isAdvanced = siteDoc?.editor_mode === 'advanced';
  const hasLayout = !!layout;
  const sectionCount = layout?.sections?.length ?? 0;
  const source = isAdvanced && hasLayout ? 'published_v2' : 'fallback';
  const metaTitle = (layout as SiteLayoutV2)?.meta?.title || '(vazio)';
  const metaDesc = (layout as SiteLayoutV2)?.meta?.description || '(vazio)';

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const { error } = await supabase.rpc('dev_force_publish_v2' as any, { p_org_id: orgId });
      if (error) {
        alert('Erro ao publicar: ' + error.message);
      } else {
        queryClient.invalidateQueries({ queryKey: ['site-document-public', orgId] });
      }
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* DEV Info Panel */}
      <div className="bg-gray-900 text-gray-100 p-4 text-xs font-mono space-y-1 border-b-4 border-yellow-400">
        <div className="text-yellow-400 font-bold text-sm mb-2">🛠 DEV Storefront V2 — Validação Pública</div>
        {loadingSite && <div className="text-blue-300">Carregando...</div>}
        {siteError && <div className="text-red-400">Erro: {(siteError as Error).message}</div>}
        {siteDoc && (
          <>
            <div><span className="text-gray-400">orgId:</span> {orgId}</div>
            <div><span className="text-gray-400">editor_mode:</span> <span className={isAdvanced ? 'text-green-400' : 'text-orange-400'}>{siteDoc.editor_mode}</span></div>
            <div><span className="text-gray-400">has layout:</span> {hasLayout ? '✅ sim' : '❌ não'}</div>
            <div><span className="text-gray-400">layout.version:</span> {(layout as any)?.version ?? 'N/A'}</div>
            <div><span className="text-gray-400">seções:</span> {sectionCount}</div>
            <div><span className="text-gray-400">source:</span> <span className={source === 'published_v2' ? 'text-green-400' : 'text-orange-400'}>{source}</span></div>
            <div><span className="text-gray-400">meta.title:</span> {metaTitle}</div>
            <div><span className="text-gray-400">meta.description:</span> {metaDesc}</div>
          </>
        )}

        {isAdvanced && !hasLayout && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-orange-300 mb-2">⚠ published_v2 está null. Use o botão abaixo para copiar draft_v2 → published_v2.</div>
            <Button
              size="sm"
              variant="gold"
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Publicar draft_v2 para teste
            </Button>
          </div>
        )}
      </div>

      {/* Renderer */}
      {loadingSite ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : isAdvanced && hasLayout ? (
        <SiteDocumentRendererV2 siteLayout={layout} properties={properties} />
      ) : (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">Fallback: sem published_v2</p>
            <p className="text-sm">editor_mode = {siteDoc?.editor_mode ?? 'N/A'} | layout = {hasLayout ? 'presente' : 'null'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
