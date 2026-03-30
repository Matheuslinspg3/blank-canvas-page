import React from "react";
import { cn } from "@/lib/utils";
import portaLogo from "@/assets/porta-logo.png";
import portaIcon from "@/assets/porta-icon.png";
import { useWhiteLabel } from "@/hooks/useWhiteLabel";

interface PortaLogoProps {
  variant?: "horizontal" | "icon";
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Force default branding (skip white-label). Use in public/marketing pages. */
  forceDefault?: boolean;
}

const sizeClasses = {
  sm: { img: "h-8", text: "text-lg", subtitle: "text-[10px]" },
  md: { img: "h-10", text: "text-xl", subtitle: "text-xs" },
  lg: { img: "h-12", text: "text-2xl", subtitle: "text-sm" },
};

export const HabitaeLogo = React.forwardRef<HTMLDivElement, PortaLogoProps>(
  ({ variant = "horizontal", size = "md", className, forceDefault = false }, ref) => {
    const sizes = sizeClasses[size];
    const wl = useWhiteLabel();
    const useWL = !forceDefault && wl.enabled;

    if (variant === "icon") {
      const iconSrc = useWL && wl.logoUrl ? wl.logoUrl : portaIcon;
      const iconAlt = useWL && wl.orgName ? wl.orgName : "Porta do Corretor";
      return (
        <div className={cn("flex items-center justify-center", className)} ref={ref}>
          <img src={iconSrc} alt={iconAlt} className={cn(sizes.img, "w-auto object-contain")} />
        </div>
      );
    }

    if (useWL && wl.logoUrl) {
      return (
        <div className={cn("flex items-center gap-2.5", className)} ref={ref}>
          <img src={wl.logoUrl} alt={wl.orgName || "Logo"} className={cn(sizes.img, "w-auto object-contain")} />
        </div>
      );
    }

    if (useWL && wl.orgName) {
      return (
        <div className={cn("flex items-center gap-2.5", className)} ref={ref}>
          <span className={cn(sizes.text, "font-bold text-foreground")}>{wl.orgName}</span>
        </div>
      );
    }

    return (
      <div className={cn("flex items-center gap-2.5", className)} ref={ref}>
        <img src={portaLogo} alt="Porta do Corretor" className={cn(sizes.img, "w-auto object-contain")} />
      </div>
    );
  }
);
HabitaeLogo.displayName = "HabitaeLogo";
