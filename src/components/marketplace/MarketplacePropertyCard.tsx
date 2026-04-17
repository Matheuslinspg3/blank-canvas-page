import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Bed, Bath, Car, Maximize, Phone, Star, Building, ImageIcon, BadgeCheck, Ruler, Sparkles, Wallet, Banknote,
} from "lucide-react";
import { formatCurrency, proxyDriveImageUrl } from "@/lib/utils";
import type { MarketplaceProperty } from "@/hooks/useMarketplace";
import type { ViewMode } from "@/pages/Marketplace";

interface MarketplacePropertyCardProps {
  property: MarketplaceProperty;
  onContactClick: (property: MarketplaceProperty) => void;
  viewMode?: ViewMode;
}

export const MarketplacePropertyCard = React.memo(function MarketplacePropertyCard({ property, onContactClick, viewMode = "grid" }: MarketplacePropertyCardProps) {
  const navigate = useNavigate();

  const getDisplayPrice = () => {
    if (property.sale_price) return formatCurrency(property.sale_price);
    if (property.sale_price_financed) return formatCurrency(property.sale_price_financed);
    if (property.rent_price) return `${formatCurrency(property.rent_price)}/mês`;
    return "Sob consulta";
  };

  const handleCardClick = () => {
    navigate(`/marketplace/${property.id}`);
  };

  const featureItems = [
    { icon: Bed, value: property.bedrooms, label: "quartos" },
    { icon: Sparkles, value: property.suites, label: "suítes" },
    { icon: Bath, value: property.bathrooms, label: "banh." },
    { icon: Car, value: property.parking_spots, label: "vagas" },
    { icon: Maximize, value: property.area_total, label: "m² total", suffix: "m²" },
    { icon: Ruler, value: property.area_built, label: "m² constr.", suffix: "m² constr." },
  ].filter(f => (f.value ?? 0) > 0);

  const location = [property.address_neighborhood, property.address_city, property.address_state]
    .filter(Boolean)
    .join(", ");

  const topAmenities = (property.amenities ?? []).slice(0, 4);
  const extraAmenitiesCount = Math.max(0, (property.amenities?.length ?? 0) - topAmenities.length);
  const topPayments = (property.payment_options ?? []).slice(0, 3);

  if (viewMode === "list") {
    return (
      <Card
        className="overflow-hidden group cursor-pointer border-border/40 hover:border-primary/20 hover:shadow-elevated card-hover-lift transition-all duration-300"
        onClick={handleCardClick}
      >
        <div className="flex flex-col sm:flex-row">
          {/* Image */}
          <div className="relative w-full sm:w-48 md:w-56 shrink-0 aspect-[16/10] sm:aspect-auto sm:h-auto bg-muted overflow-hidden">
            {property.images && property.images.length > 0 ? (
              <OptimizedImage
                src={proxyDriveImageUrl(property.images[0])}
                alt={property.title}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out-expo"
              />
            ) : (
              <div className="w-full h-full min-h-[120px] flex items-center justify-center">
                <Building className="h-10 w-10 text-muted-foreground/30" />
              </div>
            )}
            {property.is_featured && (
              <Badge className="absolute top-2 left-2 bg-warning text-foreground shadow-sm text-xs rounded-full px-2">
                <Star className="h-3 w-3 mr-1" /> Destaque
              </Badge>
            )}
          </div>

          {/* Info */}
          <CardContent className="flex-1 p-4 flex flex-col justify-between gap-2">
            <div className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold line-clamp-1 text-sm tracking-tight">{property.title}</h3>
                <Badge
                  variant={property.transaction_type === "venda" ? "default" : "secondary"}
                  className="shrink-0 text-xs rounded-full px-2"
                >
                  {property.transaction_type === "venda" ? "Venda" : property.transaction_type === "aluguel" ? "Aluguel" : "Venda/Aluguel"}
                </Badge>
              </div>
              {property.marketplace_contact_phone && (
                <Badge variant="outline" className="text-[10px] rounded-full px-2 gap-1 border-primary/30 text-primary">
                  <BadgeCheck className="h-3 w-3" /> Contato direto do anúncio
                </Badge>
              )}
              {location && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{location}</span>
                </p>
              )}
              {featureItems.length > 0 && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {featureItems.map((feat) => (
                    <span key={feat.label} className="flex items-center gap-1">
                      <feat.icon className="h-3.5 w-3.5" />
                      <span className="font-medium text-foreground">{feat.value}{feat.suffix || ""}</span>
                    </span>
                  ))}
                </div>
              )}
              {property.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{property.description}</p>
              )}
              {topAmenities.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {topAmenities.map((a) => (
                    <Badge key={a} variant="outline" className="text-[10px] rounded-full px-2 py-0 font-normal">{a}</Badge>
                  ))}
                  {extraAmenitiesCount > 0 && (
                    <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0 font-normal">+{extraAmenitiesCount}</Badge>
                  )}
                </div>
              )}
              {topPayments.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[10px] text-muted-foreground">
                  <Wallet className="h-3 w-3" />
                  <span className="truncate">{topPayments.join(" • ")}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 mt-1">
              <div className="min-w-0">
                <p className="text-base font-extrabold tracking-tight text-foreground truncate">
                  {getDisplayPrice()}
                  {property.sale_price && property.rent_price && (
                    <span className="text-xs font-normal text-muted-foreground ml-2">
                      ou {formatCurrency(property.rent_price)}/mês
                    </span>
                  )}
                </p>
                {property.sale_price_financed && property.sale_price_financed !== property.sale_price && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Banknote className="h-3 w-3" />
                    Financiado: <span className="font-semibold text-foreground">{formatCurrency(property.sale_price_financed)}</span>
                  </p>
                )}
              </div>
              <Button
                size="sm"
                className="shrink-0 rounded-xl glow-primary-hover"
                onClick={(e) => {
                  e.stopPropagation();
                  onContactClick(property);
                }}
              >
                <Phone className="h-3.5 w-3.5 mr-1.5" /> Contato
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    );
  }

  // Grid mode (default)
  return (
    <Card
      className="overflow-hidden group cursor-pointer border-border/40 hover:border-primary/20 hover:shadow-elevated card-hover-lift transition-all duration-300"
      onClick={handleCardClick}
    >
      <div className="relative aspect-[16/10] bg-muted overflow-hidden">
        {property.images && property.images.length > 0 ? (
          <OptimizedImage
            src={proxyDriveImageUrl(property.images[0])}
            alt={property.title}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out-expo"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building className="h-12 w-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-foreground/30 to-transparent pointer-events-none" />
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none">
          <div className="flex gap-1.5">
            {property.is_featured && (
              <Badge className="bg-warning text-foreground shadow-sm text-xs rounded-full px-2.5">
                <Star className="h-3 w-3 mr-1" /> Destaque
              </Badge>
            )}
            <Badge
              variant={property.transaction_type === "venda" ? "default" : "secondary"}
              className="shadow-sm text-xs rounded-full px-2.5"
            >
              {property.transaction_type === "venda" ? "Venda" : property.transaction_type === "aluguel" ? "Aluguel" : "Venda/Aluguel"}
            </Badge>
            {property.marketplace_contact_phone && (
              <Badge variant="outline" className="text-[10px] rounded-full px-2 gap-1 border-primary/40 bg-background/80 backdrop-blur-sm text-primary shadow-sm">
                <BadgeCheck className="h-3 w-3" /> Contato direto
              </Badge>
            )}
          </div>
        </div>
        {property.images && property.images.length > 1 && (
          <Badge variant="secondary" className="absolute bottom-3 right-3 text-xs shadow-sm rounded-full bg-background/80 backdrop-blur-sm">
            <ImageIcon className="h-3 w-3 mr-1" />
            {property.images.length}
          </Badge>
        )}
        <div className="absolute bottom-3 left-3">
          <p className="text-xl font-extrabold text-primary-foreground drop-shadow-md leading-tight tracking-tight">
            {getDisplayPrice()}
          </p>
          {property.sale_price && property.rent_price && (
            <p className="text-xs text-primary-foreground/80 drop-shadow-sm">
              ou {formatCurrency(property.rent_price)}/mês
            </p>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-2.5">
        <div>
          <h3 className="font-bold line-clamp-1 text-sm tracking-tight">{property.title}</h3>
          {location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location}</span>
            </p>
          )}
        </div>
        {featureItems.length > 0 && (
          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {featureItems.map((feat) => (
              <span key={feat.label} className="flex items-center gap-1">
                <feat.icon className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{feat.value}{feat.suffix || ""}</span>
              </span>
            ))}
          </div>
        )}
        {property.sale_price_financed && property.sale_price_financed !== property.sale_price && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Banknote className="h-3 w-3" />
            Financiado: <span className="font-semibold text-foreground">{formatCurrency(property.sale_price_financed)}</span>
          </p>
        )}
        {property.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{property.description}</p>
        )}
        {topAmenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topAmenities.map((a) => (
              <Badge key={a} variant="outline" className="text-[10px] rounded-full px-2 py-0 font-normal">{a}</Badge>
            ))}
            {extraAmenitiesCount > 0 && (
              <Badge variant="outline" className="text-[10px] rounded-full px-2 py-0 font-normal">+{extraAmenitiesCount}</Badge>
            )}
          </div>
        )}
        {topPayments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            <Wallet className="h-3 w-3" />
            <span className="line-clamp-1">{topPayments.join(" • ")}</span>
          </div>
        )}
        <Button
          className="w-full rounded-xl glow-primary-hover transition-all duration-300"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onContactClick(property);
          }}
        >
          <Phone className="h-4 w-4 mr-2" /> Ver contato da imobiliária
        </Button>
      </CardContent>
    </Card>
  );
});
