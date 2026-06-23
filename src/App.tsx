import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { TenantRouter } from "@/components/TenantRouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CarnivalThemeProvider } from "@/components/CarnivalThemeProvider";
import { DemoProvider } from "@/contexts/DemoContext";
import { ImportProgressProvider } from "@/contexts/ImportProgressContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/admin/AdminRoute";
import { ManagerRoute } from "@/components/admin/ManagerRoute";
import { DeveloperRoute } from "@/components/developer/DeveloperRoute";
import { DeveloperOnlyRoute } from "@/components/access/DeveloperOnlyRoute";
import { AdminOrDeveloperRoute } from "@/components/auth/AdminOrDeveloperRoute";
import { AppLayout } from "@/components/layouts/AppLayout";
import { FloatingImportProgress } from "@/components/integrations/FloatingImportProgress";
import { AppMobileLayout } from "@/components/app/AppMobileLayout";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { ClarityProvider } from "@/components/ClarityProvider";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { AttributionTracker } from "@/components/AttributionTracker";
import { Loader2 } from "lucide-react";
import { lazyRetry } from "@/utils/lazyRetry";

import { GlobalUpdateNotifier } from "@/components/GlobalUpdateNotifier";
import { PropertyLandingBoundary } from "@/components/PropertyLandingBoundary";

// Lazy-loaded pages with retry for stale chunk recovery
const Auth = lazy(() => lazyRetry(() => import("./pages/Auth")));
const ResetPassword = lazy(() => lazyRetry(() => import("./pages/ResetPassword")));
const AcceptInvite = lazy(() => lazyRetry(() => import("./pages/AcceptInvite")));
const Demo = lazy(() => lazyRetry(() => import("./pages/Demo")));
const DevBlocks = lazy(() => lazyRetry(() => import("./pages/DevBlocks")));
const DevElements = lazy(() => lazyRetry(() => import("./pages/DevElements")));
const DevSections = lazy(() => lazyRetry(() => import("./pages/DevSections")));
const DevSiteBuilderPro = lazy(() => lazyRetry(() => import("./pages/DevSiteBuilderPro")));
const DevStorefrontV2 = lazy(() => lazyRetry(() => import("./pages/DevStorefrontV2")));
const DevMigrateSiteV2 = lazy(() => lazyRetry(() => import("./pages/DevMigrateSiteV2")));
const DevSiteBuilderRollout = lazy(() => lazyRetry(() => import("./pages/DevSiteBuilderRollout")));
const SiteBuilderPage = lazy(() => lazyRetry(() => import("./pages/SiteBuilder")));
const SiteBuilderProPage = lazy(() => lazyRetry(() => import("./pages/SiteBuilderPro")));
const Dashboard = lazy(() => lazyRetry(() => import("./pages/Dashboard"), { moduleName: "Dashboard" }));
const Properties = lazy(() => lazyRetry(() => import("./pages/Properties"), { moduleName: "Properties" }));
const PropertyDetails = lazy(() => lazyRetry(() => import("./pages/PropertyDetails")));
const PropertyByCode = lazy(() => lazyRetry(() => import("./pages/PropertyByCode")));
const PropertyLandingPage = lazy(() => lazyRetry(() => import("./pages/PropertyLandingPage")));
const Marketplace = lazy(() => lazyRetry(() => import("./pages/Marketplace"), { moduleName: "Marketplace" }));
const MarketplacePropertyDetails = lazy(() => lazyRetry(() => import("./pages/MarketplacePropertyDetails")));
const CRM = lazy(() => lazyRetry(() => import("./pages/CRM"), { moduleName: "CRM" }));
const _Contracts = lazy(() => lazyRetry(() => import("./pages/Contracts")));
const Financial = lazy(() => lazyRetry(() => import("./pages/Financial"), { moduleName: "Financial" }));
const Schedule = lazy(() => lazyRetry(() => import("./pages/Schedule")));
const Settings = lazy(() => lazyRetry(() => import("./pages/Settings")));
const AdminAudit = lazy(() => lazyRetry(() => import("./pages/admin/AdminAudit")));
const MetaWebhookStatus = lazy(() => lazyRetry(() => import("./pages/admin/MetaWebhookStatus")));
const DeveloperDashboard = lazy(() => lazyRetry(() => import("./pages/developer/DeveloperDashboard")));
const RechargeCredits = lazy(() => lazyRetry(() => import("./pages/RechargeCredits")));
const RechargeHistory = lazy(() => lazyRetry(() => import("./pages/RechargeHistory")));
const RechargeApprovals = lazy(() => lazyRetry(() => import("./pages/developer/RechargeApprovals")));
const VisibilityDebug = lazy(() => lazyRetry(() => import("./pages/dev/VisibilityDebug")));
const ImportPendencies = lazy(() => lazyRetry(() => import("./pages/ImportPendencies")));
const Integrations = lazy(() => lazyRetry(() => import("./pages/Integrations")));
const LandingPage = lazy(() => lazyRetry(() => import("./pages/LandingPage")));
const NotFound = lazy(() => lazyRetry(() => import("./pages/NotFound")));
const AccessDenied = lazy(() => lazyRetry(() => import("./pages/AccessDenied")));
const PlatformSignup = lazy(() => lazyRetry(() => import("./pages/PlatformSignup")));
const OnboardingWizard = lazy(() => lazyRetry(() => import("./pages/OnboardingWizard")));
const Install = lazy(() => lazyRetry(() => import("./pages/Install")));
const Automations = lazy(() => lazyRetry(() => import("./pages/Automations")));
const _Activities = lazy(() => lazyRetry(() => import("./pages/Activities")));
const Administration = lazy(() => lazyRetry(() => import("./pages/Administration")));
const SitePage = lazy(() => lazyRetry(() => import("./pages/Site")));
const Anuncios = lazy(() => lazyRetry(() => import("./pages/Anuncios")));
const _RDStation = lazy(() => lazyRetry(() => import("./pages/RDStation")));
const MetaAdDetail = lazy(() => lazyRetry(() => import("./pages/ads/MetaAdDetail")));
const Owners = lazy(() => lazyRetry(() => import("./pages/Owners")));


const _GeradorAnuncios = lazy(() => lazyRetry(() => import("./pages/GeradorAnuncios")));
const PublicPropertyBySlug = lazy(() => lazyRetry(() => import("./pages/PublicPropertyBySlug")));
const Storefront = lazy(() => lazyRetry(() => import("./pages/Storefront")));
const PrivacyPolicy = lazy(() => lazyRetry(() => import("./pages/PrivacyPolicy")));
const TermsOfService = lazy(() => lazyRetry(() => import("./pages/TermsOfService")));
const Maintenance = lazy(() => lazyRetry(() => import("./pages/Maintenance")));
const EmailTemplates = lazy(() => lazyRetry(() => import("./pages/EmailTemplates")));
const Plans = lazy(() => lazyRetry(() => import("./pages/Plans")));
const MyPlan = lazy(() => lazyRetry(() => import("./pages/MyPlan")));
const CorrespondenteBancario = lazy(() => lazyRetry(() => import("./pages/CorrespondenteBancario")));
const MeuWhatsApp = lazy(() => lazyRetry(() => import("./pages/MeuWhatsApp")));
const WhatsAppChat = lazy(() => lazyRetry(() => import("./pages/WhatsAppChat")));

const MetricsDashboard = lazy(() => lazyRetry(() => import("./pages/MetricsDashboard")));
const Onboarding = lazy(() => lazyRetry(() => import("./pages/app/Onboarding")));
const AppAuth = lazy(() => lazyRetry(() => import("./pages/app/AppAuth")));
const AppHome = lazy(() => lazyRetry(() => import("./pages/app/Home")));
const AppSearch = lazy(() => lazyRetry(() => import("./pages/app/Search")));
const AppFavorites = lazy(() => lazyRetry(() => import("./pages/app/Favorites")));
const AppProfile = lazy(() => lazyRetry(() => import("./pages/app/Profile")));
const AppPropertyDetail = lazy(() => lazyRetry(() => import("./pages/app/PropertyDetail")));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);


const App = () => (
  <HelmetProvider>
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
  <ThemeProvider>
    <CarnivalThemeProvider>
      <AuthProvider>
        <ImportProgressProvider>
            <BrowserRouter>
              <TenantRouter>
              <GlobalUpdateNotifier />
              <ErrorBoundary>
              <DemoProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <FloatingImportProgress />
                  <ClarityProvider />
                  <AttributionTracker />
                  <CookieConsentBanner />
                  <Suspense fallback={<PageLoader />}>
                    <MaintenanceGuard>
                    <Routes>
                      <Route path="/manutencao" element={<Maintenance />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/cadastro" element={<Auth />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/convite/:id" element={<AcceptInvite />} />
                      <Route path="/cadastro/:id" element={<PlatformSignup />} />
                      <Route path="/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
                      <Route path="/demo" element={<Demo />} />
                      <Route path="/dev/blocks" element={<Suspense fallback={<div className="p-8">Carregando...</div>}><DevBlocks /></Suspense>} />
                      <Route path="/dev/elements" element={<Suspense fallback={<div className="p-8">Carregando...</div>}><DevElements /></Suspense>} />
                      <Route path="/dev/sections" element={<Suspense fallback={<div className="p-8">Carregando...</div>}><DevSections /></Suspense>} />
                      <Route path="/dev/site-builder-pro" element={<Suspense fallback={<div className="p-8">Carregando...</div>}><DevSiteBuilderPro /></Suspense>} />
                      <Route path="/dev/storefront-v2" element={<DevStorefrontV2 />} />
                      <Route path="/dev/migrate-site-v2" element={<Suspense fallback={<div className="p-8">Carregando...</div>}><DevMigrateSiteV2 /></Suspense>} />
                      <Route path="/dev/site-builder-rollout" element={<Suspense fallback={<div className="p-8">Carregando...</div>}><DevSiteBuilderRollout /></Suspense>} />
                      <Route path="/imovel/:id" element={<PropertyLandingBoundary><PropertyLandingPage /></PropertyLandingBoundary>} />
                      {/* CRITICAL — landing pública (acesso anônimo). NÃO reordenar nem duplicar.
                          A resolução em PropertyLandingPage usa RPCs públicas (RLS-safe).
                          PropertyLandingBoundary protege contra falha do lazy chunk (suspense infinito). */}
                      <Route path="/i/:orgSlug/:propertyCode" element={<PropertyLandingBoundary><PropertyLandingPage /></PropertyLandingBoundary>} />
                      <Route path="/i/:orgSlug/:propertyCode/:brokerToken" element={<PropertyLandingBoundary><PropertyLandingPage /></PropertyLandingBoundary>} />
                      <Route path="/instalar" element={<Install />} />
                      <Route path="/site/:orgSlug" element={<Storefront />} />
                      {/* legacy single-segment slug → mantém PublicPropertyBySlug */}
                      <Route path="/i/:slug" element={<PublicPropertyBySlug />} />
                      <Route path="/privacidade" element={<PrivacyPolicy />} />
                      <Route path="/termos" element={<TermsOfService />} />
                      <Route path="/email-templates" element={<EmailTemplates />} />
                      <Route path="/planos" element={<Plans />} />
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/acesso-negado" element={<AccessDenied />} />

                      {/* Consumer App routes */}
                      <Route path="/app" element={<Navigate to="/app/home" replace />} />
                      <Route path="/app/onboarding" element={<Onboarding />} />
                      <Route path="/app/auth" element={<AppAuth />} />
                      <Route element={<AppMobileLayout />}>
                        <Route path="/app/home" element={<AppHome />} />
                        <Route path="/app/busca" element={<AppSearch />} />
                        <Route path="/app/favoritos" element={<AppFavorites />} />
                        <Route path="/app/perfil" element={<AppProfile />} />
                      </Route>
                      <Route path="/app/imovel/:id" element={<AppPropertyDetail />} />
                      
                      <Route
                        element={
                          <ProtectedRoute>
                            <AppLayout />
                          </ProtectedRoute>
                        }
                      >
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/imoveis" element={<Properties />} />
                        <Route path="/proprietarios" element={<Owners />} />
                        
                        <Route path="/imoveis/pendencias" element={<ImportPendencies />} />
                        <Route path="/imoveis/codigo/:codeOrId" element={<PropertyByCode />} />
                        <Route path="/imoveis/:id" element={<PropertyDetails />} />
                        <Route path="/marketplace" element={<Marketplace />} />
                        <Route path="/marketplace/:id" element={<MarketplacePropertyDetails />} />
                        <Route path="/crm" element={<CRM />} />
                        
                        {/* Redirecionamentos de WhatsApp para Automações ou Dashboard */}
                        <Route path="/meu-whatsapp" element={<MeuWhatsApp />} />
                        <Route path="/conversas-whatsapp" element={<WhatsAppChat />} />
                        <Route path="/whatsapp/*" element={<Navigate to="/meu-whatsapp" replace />} />

                        
                        <Route path="/contratos" element={<Navigate to="/financeiro?tab=contracts" replace />} />
                        <Route path="/financeiro" element={<Financial />} />
                        <Route path="/correspondente" element={<CorrespondenteBancario />} />
                        <Route path="/metricas" element={<MetricsDashboard />} />
                        <Route path="/agenda" element={<Schedule />} />
                        
                        <Route path="/automacoes" element={<Automations />} />
                        <Route path="/atividades" element={<Navigate to="/administracao?tab=activities" replace />} />
                        <Route path="/administracao" element={<Administration />} />
                        <Route path="/site" element={<SitePage />} />
                        <Route path="/site/builder" element={<Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}><SiteBuilderPage /></Suspense>} />
                        <Route path="/site/builder-pro" element={<Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>}><SiteBuilderProPage /></Suspense>} />
                        <Route path="/integracoes" element={<Integrations />} />
                        <Route path="/configuracoes" element={<Settings />} />
                        <Route path="/meu-plano" element={<MyPlan />} />

                        {/* Marketing module - consolidated */}
                        <Route path="/marketing" element={<Anuncios />} />
                        <Route path="/marketing/ad/:externalId" element={<MetaAdDetail />} />
                        <Route path="/anuncios" element={<Navigate to="/marketing" replace />} />
                        <Route path="/anuncios/ad/:externalId" element={<Navigate to="/marketing" replace />} />
                        <Route path="/rdstation" element={<Navigate to="/marketing?section=rdstation" replace />} />
                        <Route path="/gerador-anuncios" element={<Navigate to="/marketing?section=gerador" replace />} />
                        
                        {/* Recarga de créditos (apenas admin/developer) */}
                        <Route path="/recarregar-creditos" element={
                          <AdminOrDeveloperRoute>
                            <RechargeCredits />
                          </AdminOrDeveloperRoute>
                        } />
                        <Route path="/recarregar-creditos/historico" element={
                          <AdminOrDeveloperRoute>
                            <RechargeHistory />
                          </AdminOrDeveloperRoute>
                        } />


                        {/* Developer route inside AppLayout */}
                        <Route path="/developer" element={
                          <DeveloperRoute>
                            <DeveloperDashboard />
                          </DeveloperRoute>
                        } />
                        <Route path="/developer/recargas" element={
                          <DeveloperRoute>
                            <RechargeApprovals />
                          </DeveloperRoute>
                        } />
                        
                        {/* Admin route inside AppLayout */}
                        <Route path="/admin/auditoria" element={
                          <AdminRoute>
                            <AdminAudit />
                          </AdminRoute>
                        } />
                        <Route path="/admin/meta-webhook" element={
                          <DeveloperRoute requiredRole="leader">
                            <MetaWebhookStatus />
                          </DeveloperRoute>
                        } />
                      </Route>

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    </MaintenanceGuard>
                  </Suspense>
                </TooltipProvider>
              </DemoProvider>
              </ErrorBoundary>
              </TenantRouter>
            </BrowserRouter>
        </ImportProgressProvider>
    </AuthProvider>
    </CarnivalThemeProvider>
  </ThemeProvider>
</QueryClientProvider>
  </ErrorBoundary>
  </HelmetProvider>
);

export default App;