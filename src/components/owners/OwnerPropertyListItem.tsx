import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Edit, MoreHorizontal, CheckCircle2, Hash, Building2, MapPin } from "lucide-react";
import { PropertyStatusBadge } from "@/components/properties/PropertyStatusBadge";
import { PropertyReviewBadge } from "@/components/properties/PropertyReviewBadge";
import { usePropertyReview } from "@/hooks/usePropertyReview";

export interface OwnerPropertyItem {
  id: string;
  title: string;
  property_code: string | null;
  status: string;
  address_city: string | null;
  address_neighborhood: string | null;
  cover_image_url: string | null;
  last_reviewed_at: string | null;
}

interface Props {
  property: OwnerPropertyItem;
  onNavigate: () => void;
}

export const OwnerPropertyListItem = memo(function OwnerPropertyListItem({ property, onNavigate }: Props) {
  const navigate = useNavigate();
  const reviewMutation = usePropertyReview();

  const address = [property.address_neighborhood, property.address_city].filter(Boolean).join(", ") || "Sem localização";

  const goTo = (path: string) => {
    onNavigate();
    navigate(path);
  };

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
      <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
        {property.cover_image_url ? (
          <img src={property.cover_image_url} alt={property.title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="h-4 w-4 text-muted-foreground/60" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{property.title || "Sem título"}</p>
          {property.property_code && (
            <Badge variant="outline" className="font-mono text-[10px] px-1 shrink-0">
              <Hash className="h-2.5 w-2.5 mr-0.5" />
              {property.property_code}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{address}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <PropertyStatusBadge status={property.status} className="text-[10px]" />
          <PropertyReviewBadge lastReviewedAt={property.last_reviewed_at} />
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => goTo(`/imoveis/${property.id}`)}>
            <Eye className="h-4 w-4 mr-2" /> Ver imóvel
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => goTo(`/imoveis/${property.id}?edit=1`)}>
            <Edit className="h-4 w-4 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => reviewMutation.mutate(property.id)}
            disabled={reviewMutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como revisado
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
