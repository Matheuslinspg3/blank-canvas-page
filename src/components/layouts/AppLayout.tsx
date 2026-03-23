import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useDemo } from "@/contexts/DemoContext";
import { DemoBanner } from "@/components/DemoBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { MobileTopBar } from "@/components/MobileTopBar";
import { MobileFAB } from "@/components/MobileFAB";
import { SupportFAB } from "@/components/SupportFAB";

import { RenewalBanner } from "@/components/RenewalBanner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { PushPermissionBanner } from "@/components/PushPermissionBanner";
import { APP_VERSION } from "@/config/appVersion";
import { useModuleVisit } from "@/hooks/useAnalytics";
import { GlobalCommandPalette } from "@/components/GlobalCommandPalette";

export function AppLayout() {
  const { isDemoMode } = useDemo();
  
  useModuleVisit();

  // Push notification permission is now requested only via explicit user gesture
  // (Settings page or notification bell) — not auto-prompted here

  return (
    <SidebarProvider>
      {isDemoMode && <DemoBanner />}
      <div className={`min-h-dvh flex w-full overflow-x-hidden ${isDemoMode ? "pt-10" : ""}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[10000] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
        >
          Pular para conteúdo
        </a>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <MobileTopBar />
          <RenewalBanner />
          <PushPermissionBanner />
          <main id="main-content" className="flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-0" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
            <Outlet />
          </main>
        </div>
        <MobileFAB />
        <SupportFAB />
        <MobileBottomNav />
        <PWAInstallPrompt />
        <UpdateBanner />
        <GlobalCommandPalette />
        <span className="fixed bottom-1 left-1 z-[9999] text-[10px] text-muted-foreground/70 pointer-events-none select-none hidden md:block">Porta v{APP_VERSION}</span>
      </div>
    </SidebarProvider>
  );
}
