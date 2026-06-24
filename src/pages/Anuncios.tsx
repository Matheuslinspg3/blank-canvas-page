import React, { lazy, Suspense, useEffect } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTabParam } from "@/hooks/useTabParam";
import { useAdLeadsCount } from "@/hooks/useAdLeads";
import { Loader2, Megaphone, BarChart3, Sparkles, Palette, Video, Stamp, Link2, Users, TrendingUp, LayoutList, ScrollText } from "lucide-react";
import { AiCreditsBadge } from "@/components/ai/AiCreditsBadge";
import { FeatureFlagGate } from "@/components/FeatureGate";
import { useFeatureFlag } from "@/hooks/useFeatureGate";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { DEVELOPER_ONLY_FEATURES } from "@/config/featureAccess";

import MetaConnectionTab from "@/components/ads/MetaConnectionTab";
import MetaLeadsInboxContent from "@/components/ads/MetaLeadsInboxContent";
import MetaStatsContent from "@/components/ads/MetaStatsContent";
import MetaAdsListContent from "@/components/ads/MetaAdsListContent";
import MetaWebhookLogsTab from "@/components/ads/MetaWebhookLogsTab";

import RDConnectionTab from "@/components/ads/rdstation/RDConnectionTab";
import RDLeadsTab from "@/components/ads/rdstation/RDLeadsTab";
import RDStationStatsContent from "@/components/ads/RDStationStatsContent";
import RDWebhookTab from "@/components/ads/rdstation/RDWebhookTab";

const GeradorAnunciosContent = lazy(() => import("../pages/GeradorAnuncios").then(m => ({ default: () => <m.default embedded /> })));
const GeradorArtesContent = lazy(() => import("@/components/ads/GeradorArtesContent"));
const GeradorVideoContent = lazy(() => import("@/components/ads/GeradorVideoContent"));
const BrandSettingsContent = lazy(() => import("@/components/marketing/BrandSettingsContent"));

const TabLoader = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

export default function Anuncios() {
  const [section, setSection] = useTabParam("section", "meta");
  const [metaTab, setMetaTab] = useTabParam("meta_tab", "conexao");
  const [rdTab, setRdTab] = useTabParam("rd_tab", "conexao");
  const { data: totalNew = 0 } = useAdLeadsCount();

  const { canAccessFeature } = useFeatureAccess();
  const canSeeGerador = canAccessFeature(DEVELOPER_ONLY_FEATURES.MARKETING_GERADOR_IA);
  const canSeeArtes = canAccessFeature(DEVELOPER_ONLY_FEATURES.MARKETING_ARTES);
  const canSeeVideo = canAccessFeature(DEVELOPER_ONLY_FEATURES.MARKETING_VIDEO);
  const canSeeMarca = canAccessFeature(DEVELOPER_ONLY_FEATURES.MARKETING_MARCA);

  // Redirect away from restricted sections when user lacks access
  useEffect(() => {
    if (section === "gerador" && !canSeeGerador) setSection("meta");
    else if (section === "artes" && !canSeeArtes) setSection("meta");
    else if (section === "video" && !canSeeVideo) setSection("meta");
    else if (section === "marca" && !canSeeMarca) setSection("meta");
  }, [section, canSeeGerador, canSeeArtes, canSeeVideo, canSeeMarca, setSection]);

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="Marketing"
        description="Gerencie campanhas, leads e conteúdo de marketing"
      />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        {/* Top-level sections */}
        <Tabs value={section} onValueChange={setSection}>
          <TabsList className="w-full sm:w-auto overflow-x-auto flex-nowrap justify-start scrollbar-hide">
            <TabsTrigger value="meta" className="gap-1.5 shrink-0 min-h-[44px] px-3">
              <Megaphone className="h-4 w-4" />
              Meta Ads
              {totalNew > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full bg-destructive text-destructive-foreground">
                  {totalNew}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="rdstation" className="gap-1.5 shrink-0 min-h-[44px] px-3">
              <BarChart3 className="h-4 w-4" />
              RD Station
            </TabsTrigger>
            {canSeeGerador && (
              <TabsTrigger value="gerador" className="gap-1.5 shrink-0 min-h-[44px] px-3">
                <Sparkles className="h-4 w-4" />
                Gerador IA
              </TabsTrigger>
            )}
            {canSeeArtes && (
              <TabsTrigger value="artes" className="gap-1.5 shrink-0 min-h-[44px] px-3">
                <Palette className="h-4 w-4" />
                Artes
              </TabsTrigger>
            )}
            {canSeeVideo && (
              <TabsTrigger value="video" className="gap-1.5 shrink-0 min-h-[44px] px-3">
                <Video className="h-4 w-4" />
                Vídeo
              </TabsTrigger>
            )}
            {canSeeMarca && (
              <TabsTrigger value="marca" className="gap-1.5 shrink-0 min-h-[44px] px-3">
                <Stamp className="h-4 w-4" />
                Marca
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Meta Ads ── */}
          <TabsContent value="meta" className="mt-4 space-y-4">
            <>{/* Meta Ads disponível para todos os usuários */}
              <Tabs value={metaTab} onValueChange={setMetaTab}>
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="conexao" className="flex-1 sm:flex-initial min-h-[40px] gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    Conexão
                  </TabsTrigger>
                  <TabsTrigger value="leads" className="flex-1 sm:flex-initial min-h-[40px] gap-1.5 relative">
                    <Users className="h-3.5 w-3.5" />
                    Leads
                    {totalNew > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] rounded-full bg-destructive text-destructive-foreground">
                        {totalNew}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="estatisticas" className="flex-1 sm:flex-initial min-h-[40px] gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Estatísticas
                  </TabsTrigger>
                  <TabsTrigger value="anuncios" className="flex-1 sm:flex-initial min-h-[40px] gap-1.5">
                    <LayoutList className="h-3.5 w-3.5" />
                    Anúncios
                  </TabsTrigger>
                  <TabsTrigger value="webhook_logs" className="flex-1 sm:flex-initial min-h-[40px] gap-1.5">
                    <ScrollText className="h-3.5 w-3.5" />
                    Logs de Sincronização
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="conexao" className="mt-4"><MetaConnectionTab /></TabsContent>
                <TabsContent value="leads" className="mt-4"><MetaLeadsInboxContent /></TabsContent>
                <TabsContent value="estatisticas" className="mt-4"><MetaStatsContent /></TabsContent>
                <TabsContent value="anuncios" className="mt-4"><MetaAdsListContent /></TabsContent>
                <TabsContent value="webhook_logs" className="mt-4"><MetaWebhookLogsTab /></TabsContent>
              </Tabs>
            </>
          </TabsContent>

          {/* ── RD Station ── */}
          <TabsContent value="rdstation" className="mt-4 space-y-4">
            <FeatureFlagGate featureKey="has_rd_station">
              <Tabs value={rdTab} onValueChange={setRdTab}>
                <TabsList className="w-full sm:w-auto">
                  <TabsTrigger value="conexao" className="flex-1 sm:flex-initial min-h-[40px] gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    Conexão
                  </TabsTrigger>
                  <TabsTrigger value="leads" className="flex-1 sm:flex-initial min-h-[40px] gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    Leads
                  </TabsTrigger>
                  <TabsTrigger value="estatisticas" className="flex-1 sm:flex-initial min-h-[40px] gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Estatísticas
                  </TabsTrigger>
                  <TabsTrigger value="webhook_logs" className="flex-1 sm:flex-initial min-h-[40px] gap-1.5">
                    <ScrollText className="h-3.5 w-3.5" />
                    Webhook Logs
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="conexao" className="mt-4"><RDConnectionTab /></TabsContent>
                <TabsContent value="leads" className="mt-4"><RDLeadsTab /></TabsContent>
                <TabsContent value="estatisticas" className="mt-4"><RDStationStatsContent /></TabsContent>
                <TabsContent value="webhook_logs" className="mt-4"><RDWebhookTab /></TabsContent>
              </Tabs>
            </FeatureFlagGate>
          </TabsContent>

          {/* ── Gerador IA ── */}
          {canSeeGerador && (
            <TabsContent value="gerador" className="mt-4 space-y-3">
              <FeatureFlagGate featureKey="has_ad_generator">
                <AiCreditsBadge />
                <Suspense fallback={<TabLoader />}>
                  <GeradorAnunciosContent />
                </Suspense>
              </FeatureFlagGate>
            </TabsContent>
          )}

          {/* ── Gerador de Artes ── */}
          {canSeeArtes && (
            <TabsContent value="artes" className="mt-4 space-y-3">
              <FeatureFlagGate featureKey="has_ad_generator">
                <AiCreditsBadge />
                <Suspense fallback={<TabLoader />}>
                  <GeradorArtesContent />
                </Suspense>
              </FeatureFlagGate>
            </TabsContent>
          )}

          {/* ── Gerador de Vídeo ── */}
          {canSeeVideo && (
            <TabsContent value="video" className="mt-4 space-y-3">
              <FeatureFlagGate featureKey="has_ad_generator">
                <AiCreditsBadge />
                <Suspense fallback={<TabLoader />}>
                  <GeradorVideoContent />
                </Suspense>
              </FeatureFlagGate>
            </TabsContent>
          )}

          {/* ── Marca / Identidade Visual ── */}
          {canSeeMarca && (
            <TabsContent value="marca" className="mt-4">
              <FeatureFlagGate featureKey="has_brand_settings">
                <Suspense fallback={<TabLoader />}>
                  <BrandSettingsContent />
                </Suspense>
              </FeatureFlagGate>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
