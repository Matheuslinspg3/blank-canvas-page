import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { TenantRouter } from "@/components/TenantRouter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
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
import { AppLayout } from "@/components/layouts/AppLayout";
import { FloatingImportProgress } from "@/components/integrations/FloatingImportProgress";
import { AppMobileLayout } from "@/components/app/AppMobileLayout";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { ClarityProvider } from "@/components/ClarityProvider";
import { MaintenanceGuard } from "@/components/MaintenanceGuard";
import { Loader2 } from "lucide-react";
import { lazyRetry } from "@/utils/lazyRetry";

// Lazy-loaded pages with retry for stale chunk recovery
const Auth = lazy(() => lazyRetry(() => import("./pages/Auth")));
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
const Dashboard = lazy(() => lazyRetry(() => import("./pages/Dashboard")));
const Properties = lazy(() => lazyRetry(() => import("./pages/Properties")));
const PropertyDetails = lazy(() => lazyRetry(() => import("./pages/PropertyDetails")));
const PropertyByCode = lazy(() => lazyRetry(() => import("./pages/PropertyByCode")));
const PropertyLandingPage = lazy(() => lazyRetry(() => import("./pages/PropertyLandingPage")));
const Marketplace = lazy(() => lazyRetry(() => import("./pages/Marketplace")));
const MarketplacePropertyDetails = lazy(() => lazyRetry(() => import("./pages/MarketplacePropertyDetails")));
const CRM = lazy(() => lazyRetry(() => import("./pages/CRM")));
const _Contracts = lazy(() => lazyRetry(() => import("./pages/Contracts")));
const Financial = lazy(() => lazyRetry(() => import("./pages/Financial")));
const Schedule = lazy(() => lazyRetry(() => import("./pages/Schedule")));
const Settings = lazy(() => lazyRetry(() => import("./pages/Settings")));
const AdminAudit = lazy(() => lazyRetry(() => import("./pages/admin/AdminAudit")));
const DeveloperDashboard = lazy(() => lazyRetry(() => import("./pages/developer/DeveloperDashboard")));
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
const Maintenance = lazy(() => lazyRetry(() => import("./pages/Maintenance")));
const EmailTemplates = lazy(() => lazyRetry(() => import("./pages/EmailTemplates")));
const Plans = lazy(() => lazyRetry(() => import("./pages/Plans")));
const MyPlan = lazy(() => lazyRetry(() => import("./pages/MyPlan")));
const CorrespondenteBancario = lazy(() => lazyRetry(() => import("./pages/CorrespondenteBancario")));
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

// PERF: gcTime 10min, staleTime 2min, retry with exponential backoff for resilience
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (auth, not found, etc.)
        const msg = (error as any)?.message || '';
        if (msg.includes('401') || msg.includes('403') || msg.includes('404')) return false;
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      retryDelay: 2000,
      onError: (error) => {
        Sentry.captureException(error, { tags: { source: 'react-query-mutation' } });
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Skip AbortError (cancelled requests from navigation)
      const msg = error instanceof Error ? error.message : (error as any)?.message;
      if (typeof msg === 'string' && msg.includes('AbortError')) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;

      Sentry.captureException(error, {
        tags: { source: 'react-query', queryKey: JSON.stringify(query.queryKey).slice(0, 200) },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      const msg = error instanceof Error ? error.message : (error as any)?.message;
      if (typeof msg === 'string' && msg.includes('AbortError')) return;

      Sentry.captureException(error, { tags: { source: 'react-query-mutation' } });
    },
  }),
});

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
              <ErrorBoundary>
              <DemoProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <FloatingImportProgress />
                  <ClarityProvider />
                  <CookieConsentBanner />
                  <Suspense fallback={<PageLoader />}>
                    <MaintenanceGuard>
                    <Routes>
                      <Route path="/manutencao" element={<Maintenance />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/cadastro" element={<Auth />} />
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
                      <Route path="/imovel/:id" element={<PropertyLandingPage />} />
                      <Route path="/instalar" element={<Install />} />
                      <Route path="/site/:orgSlug" element={<Storefront />} />
                      <Route path="/i/:orgSlug/:code" element={<PublicPropertyBySlug />} />
                      <Route path="/i/:slug" element={<PublicPropertyBySlug />} />
                      <Route path="/privacidade" element={<PrivacyPolicy />} />
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
                        <Route path="/contratos" element={<Navigate to="/financeiro?tab=contracts" replace />} />
                        <Route path="/financeiro" element={<Financial />} />
                        <Route path="/correspondente" element={<CorrespondenteBancario />} />
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
                        
                        {/* Developer route inside AppLayout */}
                        <Route path="/developer" element={
                          <DeveloperRoute>
                            <DeveloperDashboard />
                          </DeveloperRoute>
                        } />
                        
                        {/* Admin route inside AppLayout */}
                        <Route path="/admin/auditoria" element={
                          <AdminRoute>
                            <AdminAudit />
                          </AdminRoute>
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
