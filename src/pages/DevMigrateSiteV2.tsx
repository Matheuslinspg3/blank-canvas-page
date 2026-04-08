import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSiteDocumentPublic } from '@/hooks/useSiteDocumentPublic';
import { useStorefrontByOrgId } from '@/hooks/useStorefrontByOrgId';
import { SiteDocumentRendererV2 } from '@/components/storefront/v3/SiteDocumentRendererV2';
import { StorefrontTemplateRenderer, type SiteTemplate } from '@/components/storefront/templates/StorefrontTemplateRenderer';
import { convertLegacyToSiteLayoutV2 } from '@/lib/convertLegacyToSiteLayoutV2';
import type { SiteLayoutV2 } from '@/types/siteBuilderV2';
import { Loader2 } from 'lucide-react';

const DEFAULT_ORG = 'cdf3f0e6-da64-4090-bc76-1758796bea28';

export default function DevMigrateSiteV2() {
  const [params] = useSearchParams();
  const orgId = params.get('orgId') || DEFAULT_ORG;
  const queryClient = useQueryClient();

  const { org, brand, website, properties, isLoading } = useStorefrontByOrgId(orgId);
  const { data: siteDoc, isLoading: docLoading } = useSiteDocumentPublic(orgId);

  const [busy, setBusy] = useState('');
  const [previewV2, setPreviewV2] = useState<SiteLayoutV2 | null>(null);

  const template: SiteTemplate = (website?.site_template as SiteTemplate) || 'classic';
  const hasLayout = !!(siteDoc?.layout);
  const v2Layout = hasLayout ? (siteDoc!.layout as SiteLayoutV2) : null;

  // Generate a preview from legacy without saving
  const handleGeneratePreview = () => {
    if (!org) return;
    const layout = convertLegacyToSiteLayoutV2({ org, brand, website, template });
    setPreviewV2(layout);
  };

  // Save draft_v2 to DB
  const handleSaveDraft = async (force = false) => {
    if (!org) return;
    if (!force && v2Layout) {
      if (!confirm('draft_v2 já existe. Sobrescrever?')) return;
    }
    const layout = previewV2 || convertLegacyToSiteLayoutV2({ org, brand, website, template });
    setBusy('saving');
    try {
      const { error } = await (supabase.rpc as any)('dev_save_draft_v2', { p_org_id: orgId, p_layout: layout });
      if (error) throw error;
      invalidateAll();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setBusy('');
    }
  };

  const handlePublish = async () => {
    if (!confirm('Copiar draft_v2 → published_v2?')) return;
    setBusy('publishing');
    try {
      const { error } = await (supabase.rpc as any)('dev_force_publish_v2', { p_org_id: orgId });
      if (error) throw error;
      invalidateAll();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setBusy('');
    }
  };

  const handleSetMode = async (mode: string) => {
    if (!confirm(`Trocar editor_mode para "${mode}"?`)) return;
    setBusy('mode');
    try {
      const { error } = await (supabase.rpc as any)('dev_set_editor_mode', { p_org_id: orgId, p_mode: mode });
      if (error) throw error;
      invalidateAll();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setBusy('');
    }
  };

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['site-document-public', orgId] });
    queryClient.invalidateQueries({ queryKey: ['storefront-org-by-id', orgId] });
  }

  if (isLoading || docLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const primaryColor = brand?.primary_color || '#3B82F6';
  const metaTitle = v2Layout?.meta?.title || website?.meta_title || org?.name || '';
  const metaDesc = v2Layout?.meta?.description || website?.meta_description || '';

  const displayV2 = previewV2 || v2Layout;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }} className="min-h-screen bg-gray-50">
      {/* ── DEV Info Panel ── */}
      <div className="bg-gray-900 text-white p-4 text-xs font-mono space-y-1">
        <div className="font-bold text-sm mb-2">🔧 DEV — Migrate Site to V2</div>
        <div><b>orgId:</b> {orgId}</div>
        <div><b>org name:</b> {org?.name || '—'}</div>
        <div><b>editor_mode:</b> <span className={siteDoc?.editor_mode === 'advanced' ? 'text-green-400' : 'text-yellow-400'}>{siteDoc?.editor_mode || '—'}</span></div>
        <div><b>template legado:</b> {template}</div>
        <div><b>has layout (published_v2):</b> {hasLayout ? '✅' : '❌'}</div>
        <div><b>layout.version:</b> {v2Layout?.version || '—'}</div>
        <div><b>sections:</b> {v2Layout?.sections?.length ?? 0}</div>
        <div><b>meta_title:</b> {metaTitle || '—'}</div>
        <div><b>meta_description:</b> {metaDesc || '—'}</div>
      </div>

      {/* ── Actions ── */}
      <div className="p-4 bg-white border-b flex flex-wrap gap-2">
        <button onClick={handleGeneratePreview} className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700" disabled={!org}>
          👁 Preview V2 do legado
        </button>
        <button onClick={() => handleSaveDraft(false)} className="px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700" disabled={!!busy || !org}>
          {busy === 'saving' ? '⏳' : '💾'} Salvar como draft_v2
        </button>
        <button onClick={handlePublish} className="px-3 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700" disabled={!!busy}>
          {busy === 'publishing' ? '⏳' : '🚀'} Copiar draft → published
        </button>
        <button onClick={() => handleSetMode('advanced')} className="px-3 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700" disabled={!!busy}>
          Ativar advanced
        </button>
        <button onClick={() => handleSetMode('simple')} className="px-3 py-2 bg-gray-600 text-white rounded text-sm hover:bg-gray-700" disabled={!!busy}>
          Voltar simple
        </button>
      </div>

      {/* ── Side-by-side preview ── */}
      <div className="grid grid-cols-2 gap-0 min-h-[80vh]">
        {/* Left: Legacy */}
        <div className="border-r overflow-auto">
          <div className="bg-yellow-100 text-yellow-900 text-xs font-bold px-3 py-1 text-center">LEGADO — Template "{template}"</div>
          {org && (
            <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', minHeight: '200%' }}>
              <StorefrontTemplateRenderer
                template={template}
                org={org}
                brand={brand}
                website={website}
                properties={properties}
                primaryColor={primaryColor}
              />
            </div>
          )}
        </div>

        {/* Right: V2 */}
        <div className="overflow-auto">
          <div className="bg-green-100 text-green-900 text-xs font-bold px-3 py-1 text-center">V2 — Renderer Avançado</div>
          {displayV2 ? (
            <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%', minHeight: '200%' }}>
              <SiteDocumentRendererV2 siteLayout={displayV2} properties={properties} />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              Nenhum layout V2. Clique em "Preview V2 do legado" para gerar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
