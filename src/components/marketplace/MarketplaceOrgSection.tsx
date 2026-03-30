import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Building, ChevronDown, ChevronUp } from "lucide-react";
import { MarketplacePropertyCard } from "./MarketplacePropertyCard";
import type { MarketplaceProperty, MarketplaceOrgInfo } from "@/hooks/useMarketplace";
import type { ViewMode } from "@/pages/Marketplace";

interface MarketplaceOrgSectionProps {
  org: MarketplaceOrgInfo;
  properties: MarketplaceProperty[];
  onContactClick: (property: MarketplaceProperty) => void;
  initialCount: number;
  viewMode: ViewMode;
}

export const MarketplaceOrgSection = React.memo(function MarketplaceOrgSection({
  org,
  properties,
  onContactClick,
  initialCount,
  viewMode,
}: MarketplaceOrgSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleProperties = useMemo(
    () => (expanded ? properties : properties.slice(0, initialCount)),
    [expanded, properties, initialCount]
  );

  const remaining = properties.length - initialCount;
  const canExpand = properties.length > initialCount;

  return (
    <section className="space-y-4">
      {/* Org header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg border border-border/50 bg-muted flex items-center justify-center overflow-hidden shrink-0">
          {org.logo_url ? (
            <OptimizedImage
              src={org.logo_url}
              alt={org.name}
              aspectRatio="1/1"
              wrapperClassName="w-full h-full"
              className="object-contain"
            />
          ) : (
            <Building className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-bold text-sm truncate">{org.name}</h2>
          <p className="text-xs text-muted-foreground">
            {properties.length} {properties.length === 1 ? "imóvel" : "imóveis"}
          </p>
        </div>
      </div>

      {/* Property grid or list */}
      <div className={
        viewMode === "list"
          ? "flex flex-col gap-4"
          : "grid gap-6 md:grid-cols-2 lg:grid-cols-3"
      }>
        {visibleProperties.map((property) => (
          <MarketplacePropertyCard
            key={property.id}
            property={property}
            onContactClick={onContactClick}
            viewMode={viewMode}
          />
        ))}
      </div>

      {/* Expand / Collapse */}
      {canExpand && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" /> Ver menos
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" /> Ver todos ({remaining}{" "}
                {remaining === 1 ? "imóvel" : "imóveis"})
              </>
            )}
          </Button>
        </div>
      )}
    </section>
  );
});
