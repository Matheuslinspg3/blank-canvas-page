import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { useMarketplace, useMarketplaceFilterData, useMarketplaceOrganizations, type MarketplaceProperty, type MarketplaceOrgInfo } from "@/hooks/useMarketplace";
import { MarketplaceFilters, type MarketplaceFiltersState, defaultMarketplaceFilters } from "@/components/marketplace/MarketplaceFilters";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Building, Loader2, LayoutGrid, List } from "lucide-react";
import { MarketplaceOrgSection } from "@/components/marketplace/MarketplaceOrgSection";
import { ContactDialog } from "@/components/marketplace/ContactDialog";
import { useExternalListings } from "@/hooks/useExternalListings";
import { ExternalPropertyCard } from "@/components/marketplace/ExternalPropertyCard";

export type ViewMode = "grid" | "list";

export default function Marketplace() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<MarketplaceFiltersState>(defaultMarketplaceFilters);
  const [appliedExternalFilters, setAppliedExternalFilters] = useState<{ city?: string; transactionType?: string; bedrooms?: number } | null>(null);
  const [contactProperty, setContactProperty] = useState<MarketplaceProperty | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [orgPageSize, setOrgPageSize] = useState<number>(10);

  const { properties, isLoading, isFetching, totalCount, logContactAccess } = useMarketplace(filters);
  const { cities, neighborhoods, propertyTypes, availableAmenities } = useMarketplaceFilterData(filters.city || undefined);

  // External listings — only triggered when user clicks "Aplicar Filtros"
  const { data: externalListings = [], isLoading: externalLoading, isPolling: externalPolling } = useExternalListings(
    appliedExternalFilters ?? {}
  );

  const orgIds = useMemo(() => {
    const ids = new Set(properties.map((p) => p.organization_id).filter(Boolean) as string[]);
    return Array.from(ids);
  }, [properties]);

  const { data: orgs } = useMarketplaceOrganizations(orgIds);

  const groupedByOrg = useMemo(() => {
    const orgMap = new Map<string, MarketplaceProperty[]>();
    for (const p of properties) {
      const key = p.organization_id ?? "__unknown";
      if (!orgMap.has(key)) orgMap.set(key, []);
      orgMap.get(key)!.push(p);
    }

    const orgInfoMap = new Map<string, MarketplaceOrgInfo>();
    if (orgs) {
      for (const o of orgs) orgInfoMap.set(o.id, o);
    }

    return Array.from(orgMap.entries())
      .map(([orgId, props]) => ({
        orgId,
        org: orgInfoMap.get(orgId) ?? { id: orgId, name: "Imobiliária", logo_url: null, slug: "" },
        properties: props,
      }))
      .sort((a, b) => b.properties.length - a.properties.length);
  }, [properties, orgs]);

  const updateFilter = useCallback(<K extends keyof MarketplaceFiltersState>(key: K, value: MarketplaceFiltersState[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultMarketplaceFilters);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.transactionType !== "all") count++;
    if (filters.propertyTypeId !== "all") count++;
    if (filters.minPrice !== null) count++;
    if (filters.maxPrice !== null) count++;
    if (filters.minBedrooms !== null) count++;
    if (filters.minSuites !== null) count++;
    if (filters.minBathrooms !== null) count++;
    if (filters.minParking !== null) count++;
    if (filters.city) count++;
    if (filters.neighborhood) count++;
    if (filters.minArea !== null) count++;
    if (filters.maxArea !== null) count++;
    if (filters.amenities.length > 0) count++;
    if (filters.featured) count++;
    return count;
  }, [filters]);

  const handleContactClick = async (property: MarketplaceProperty) => {
    await logContactAccess(property.id);
    setContactProperty(property);
  };

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="Marketplace"
        description="Explore imóveis exclusivos de parceiros"
      />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        <MarketplaceFilters
          filters={filters}
          onUpdateFilter={updateFilter}
          onClearFilters={clearFilters}
          activeFilterCount={activeFilterCount}
          cities={cities}
          neighborhoods={neighborhoods}
          propertyTypes={propertyTypes}
          availableAmenities={availableAmenities}
        />

        {/* Controls bar */}
        {!isLoading && (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              {totalCount === 0 ? "Nenhum imóvel encontrado" : (
                <><span className="font-medium text-foreground">{totalCount}</span> {totalCount === 1 ? "imóvel encontrado" : "imóveis encontrados"}</>
              )}
            </p>

            <div className="flex items-center gap-2">
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

              {/* Quantity per org */}
              <Select value={String(orgPageSize)} onValueChange={(v) => setOrgPageSize(Number(v))}>
                <SelectTrigger className="w-auto h-8 text-xs gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 por imob.</SelectItem>
                  <SelectItem value="25">25 por imob.</SelectItem>
                  <SelectItem value="50">50 por imob.</SelectItem>
                  <SelectItem value="100">100 por imob.</SelectItem>
                </SelectContent>
              </Select>

              {/* View mode toggles */}
              <div className="flex border border-border rounded-md overflow-hidden">
                <Toggle
                  size="sm"
                  pressed={viewMode === "grid"}
                  onPressedChange={() => setViewMode("grid")}
                  className="rounded-none h-8 w-8 p-0"
                  aria-label="Visualização em grade"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Toggle>
                <Toggle
                  size="sm"
                  pressed={viewMode === "list"}
                  onPressedChange={() => setViewMode("list")}
                  className="rounded-none h-8 w-8 p-0"
                  aria-label="Visualização em lista"
                >
                  <List className="h-4 w-4" />
                </Toggle>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border overflow-hidden">
                <Skeleton className="aspect-[16/10] w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex gap-3">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-14" />
                  </div>
                  <Skeleton className="h-6 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : properties.length === 0 && externalListings.length === 0 && !externalLoading && !externalPolling ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">Nenhum imóvel encontrado</CardTitle>
              <CardDescription className="mb-4 text-center">
                {activeFilterCount > 0
                  ? "Nenhum imóvel corresponde aos filtros aplicados. Tente ajustar sua busca."
                  : "Ainda não há imóveis de outras imobiliárias no marketplace."}
              </CardDescription>
              {activeFilterCount === 0 && (
                <Button variant="outline" onClick={() => navigate('/imoveis')}>
                  <Building className="h-4 w-4 mr-2" /> Ver meus imóveis
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {groupedByOrg.map(({ orgId, org, properties: orgProperties }) => (
              <MarketplaceOrgSection
                key={orgId}
                org={org}
                properties={orgProperties}
                onContactClick={handleContactClick}
                initialCount={orgPageSize}
                viewMode={viewMode}
              />
            ))}
          </div>
        )}

        {/* External portal listings — always visible outside internal results */}
        {(externalLoading || externalPolling) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando imóveis em portais externos...
          </div>
        )}
        {externalListings.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Imóveis de Portais Externos</h2>
              <span className="text-xs text-muted-foreground">({externalListings.length} encontrados)</span>
            </div>
            <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
              {externalListings.map((listing) => (
                <ExternalPropertyCard key={listing.id} listing={listing} viewMode={viewMode} />
              ))}
            </div>
          </div>
        )}
      </div>

      <ContactDialog property={contactProperty} open={!!contactProperty} onOpenChange={(open) => !open && setContactProperty(null)} />
    </div>
  );
}
