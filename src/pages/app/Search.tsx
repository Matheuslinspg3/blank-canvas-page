import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConsumerPropertyCard } from "@/components/app/ConsumerPropertyCard";
import { PropertyCardSkeleton } from "@/components/app/PropertyCardSkeleton";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { useConsumerProperties } from "@/hooks/useConsumerProperties";
import { useConsumerFavorites } from "@/hooks/useConsumerFavorites";
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { supabase } from "@/integrations/supabase/client";
import { proxyDriveImageUrl } from "@/lib/utils";
import { useDebounce } from "@/hooks/useDebounce";

export default function AppSearch() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [city, setCity] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState<string | undefined>(searchParams.get("transacao") ?? undefined);
  const [bedrooms, setBedrooms] = useState<number | undefined>(
    searchParams.get("quartos") ? Number(searchParams.get("quartos")) : undefined
  );
  const [cities, setCities] = useState<string[]>(
    searchParams.get("cidades") ? searchParams.get("cidades")!.split(",").filter(Boolean) : []
  );
  const [neighborhoods, setNeighborhoods] = useState<string[]>(
    searchParams.get("bairros") ? searchParams.get("bairros")!.split(",").filter(Boolean) : []
  );
  const [propertyTypeIds, setPropertyTypeIds] = useState<string[]>(
    searchParams.get("tipos") ? searchParams.get("tipos")!.split(",").filter(Boolean) : []
  );

  const [showFilters, setShowFilters] = useState(false);
  const [userId, setUserId] = useState<string>();
  const debouncedCity = useDebounce(city, 300);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  // Sync filtros para URL (link compartilhável)
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedCity) params.set("q", debouncedCity);
    if (type) params.set("transacao", type);
    if (bedrooms) params.set("quartos", String(bedrooms));
    if (cities.length > 0) params.set("cidades", cities.join(","));
    if (neighborhoods.length > 0) params.set("bairros", neighborhoods.join(","));
    if (propertyTypeIds.length > 0) params.set("tipos", propertyTypeIds.join(","));
    setSearchParams(params, { replace: true });
  }, [debouncedCity, type, bedrooms, cities, neighborhoods, propertyTypeIds, setSearchParams]);

  const { propertyTypes } = usePropertyTypes();

  const { data: properties, isLoading } = useConsumerProperties({
    city: cities.length === 0 ? debouncedCity || undefined : undefined,
    cities: cities.length > 0 ? cities : undefined,
    neighborhoods: neighborhoods.length > 0 ? neighborhoods : undefined,
    propertyTypeIds: propertyTypeIds.length > 0 ? propertyTypeIds : undefined,
    transactionType: type,
    bedrooms,
  });

  const { favorites, toggleFavorite } = useConsumerFavorites(userId);

  return (
    <div className="min-h-screen bg-background safe-area-top">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b px-4 py-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cidade ou bairro..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="pl-10 h-11 rounded-xl"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-xl shrink-0"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Tipo de transação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="aluguel">Aluguel</SelectItem>
                </SelectContent>
              </Select>
              <Select value={bedrooms?.toString()} onValueChange={(v) => setBedrooms(Number(v))}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Quartos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1+</SelectItem>
                  <SelectItem value="2">2+</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <MultiSelectFilter
              value={propertyTypeIds}
              onChange={setPropertyTypeIds}
              options={propertyTypes.map((t) => ({ value: t.id, label: t.name }))}
              triggerLabel="Tipo de imóvel"
              triggerClassName="w-full rounded-xl"
              searchPlaceholder="Buscar tipo..."
            />
          </div>
        )}
      </header>

      <div className="px-4 py-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <PropertyCardSkeleton key={i} />)}
          </div>
        ) : !properties || properties.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhum imóvel encontrado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {properties.map((p) => (
              <ConsumerPropertyCard
                key={p.id}
                id={p.id!}
                title={p.title || "Imóvel"}
                neighborhood={p.address_neighborhood}
                city={p.address_city}
                salePrice={p.sale_price}
                rentPrice={p.rent_price}
                transactionType={p.transaction_type || "venda"}
                bedrooms={p.bedrooms}
                parkingSpots={p.parking_spots}
                areaTotal={p.area_total}
                imageUrl={p.images?.[0] ? proxyDriveImageUrl(p.images[0]) : null}
                isFavorite={favorites.has(p.id!)}
                onFavoriteToggle={toggleFavorite}
                onClick={(id) => navigate(`/app/imovel/${id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
