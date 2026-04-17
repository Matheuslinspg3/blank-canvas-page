import { useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircleQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { SupportTicketDialog } from "@/components/settings/SupportTicketDialog";
import { useIsMobile } from "@/hooks/use-mobile";

// Mantém em sincronia com FAB_CONFIG em MobileFAB.tsx — quando há MobileFAB
// na rota, o SupportFAB sobe para não sobrepor.
const ROUTES_WITH_MOBILE_FAB = ["/imoveis", "/crm", "/agenda", "/contratos"];

export function SupportFAB() {
  const [pulse, setPulse] = useState(false);
  const isMobile = useIsMobile();
  const { pathname } = useLocation();

  const hasMobileFab = ROUTES_WITH_MOBILE_FAB.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  return (
    <div
      className={cn(
        "fixed z-50 transition-all duration-300",
        // Desktop: bottom-right corner
        "right-6 bottom-6",
        // Mobile sem FAB de ação: acima da bottom nav
        isMobile && !hasMobileFab && "right-4 bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]",
        // Mobile com FAB de ação (+): empilha acima do MobileFAB para não sobrepor
        isMobile && hasMobileFab && "right-4 bottom-[calc(10.5rem+env(safe-area-inset-bottom,0px))]"
      )}
    >
      <SupportTicketDialog
        trigger={
          <button
            onClick={() => setPulse(false)}
            className={cn(
              "flex items-center justify-center",
              "w-12 h-12 md:w-14 md:h-14 rounded-full",
              "bg-primary text-primary-foreground",
              "shadow-lg hover:shadow-xl",
              "transition-all duration-200",
              "active:scale-90 touch-manipulation",
              pulse && "animate-pulse"
            )}
            aria-label="Reportar problema"
            title="Reportar problema"
          >
            <MessageCircleQuestion className="h-5 w-5 md:h-6 md:w-6" />
          </button>
        }
      />
    </div>
  );
}
