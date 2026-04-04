import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bed, Bath, Car, Maximize, ExternalLink } from "lucide-react";
import type { ExternalListing } from "@/hooks/useExternalListings";

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  olx: { label: "OLX", color: "text-orange-700", bg: "bg-orange-100 border-orange-300" },
  vivareal: { label: "Viva Real", color: "text-purple-700", bg: "bg-purple-100 border-purple-300" },
  chavesnamao: { label: "Chaves na Mão", color: "text-blue-700", bg: "bg-blue-100 border-blue-300" },
  zapimoveis: { label: "Zap Imóveis", color: "text-green-700", bg: "bg-green-100 border-green-300" },
};

function formatPrice(value: number | null) {
  if (!value) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

interface Props {
  listing: ExternalListing;
  viewMode?: "grid" | "list";
}

export function ExternalPropertyCard({ listing, viewMode = "grid" }: Props) {
  const source = SOURCE_CONFIG[listing.source] || { label: listing.source, color: "text-muted-foreground", bg: "bg-muted" };
  const imageUrl = listing.images?.[0] || null;
  const price = listing.sale_price ? formatPrice(listing.sale_price) : formatPrice(listing.rent_price);
  const priceLabel = listing.sale_price ? "Venda" : "Aluguel";

  if (viewMode === "list") {
    return (
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex">
          <div className="w-40 h-32 shrink-0 bg-muted">
            {imageUrl ? (
              <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">Sem foto</div>
            )}
          </div>
          <CardContent className="flex-1 p-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${source.bg} ${source.color}`}>
                  {source.label}
                </Badge>
                {price && <span className="text-sm font-semibold text-foreground">{price}</span>}
              </div>
              <h3 className="text-sm font-medium line-clamp-1">{listing.title}</h3>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {[listing.address_neighborhood, listing.address_city].filter(Boolean).join(", ")}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1">
              {listing.bedrooms != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Bed className="h-3 w-3" />{listing.bedrooms}</span>
              )}
              {listing.bathrooms != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Bath className="h-3 w-3" />{listing.bathrooms}</span>
              )}
              {listing.parking_spots != null && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Car className="h-3 w-3" />{listing.parking_spots}</span>
              )}
              <a href={listing.source_url} target="_blank" rel="noopener noreferrer" className="ml-auto">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <ExternalLink className="h-3 w-3" /> Ver no portal
                </Button>
              </a>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-[16/10] bg-muted">
        {imageUrl ? (
          <img src={imageUrl} alt={listing.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">Sem foto</div>
        )}
        <Badge variant="outline" className={`absolute top-2 left-2 text-[10px] border ${source.bg} ${source.color}`}>
          {source.label}
        </Badge>
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2">{listing.title}</h3>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {[listing.address_neighborhood, listing.address_city].filter(Boolean).join(", ")}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {listing.bedrooms != null && (
            <span className="flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{listing.bedrooms}</span>
          )}
          {listing.bathrooms != null && (
            <span className="flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{listing.bathrooms}</span>
          )}
          {listing.parking_spots != null && (
            <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{listing.parking_spots}</span>
          )}
          {listing.area_total != null && (
            <span className="flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{listing.area_total}m²</span>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          {price && (
            <div>
              <span className="text-xs text-muted-foreground">{priceLabel}</span>
              <p className="text-base font-bold text-foreground">{price}</p>
            </div>
          )}
          <a href={listing.source_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1">
              <ExternalLink className="h-3.5 w-3.5" /> Ver no portal
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
