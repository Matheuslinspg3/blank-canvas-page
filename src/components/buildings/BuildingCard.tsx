import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Layers, Home, Calendar, Pencil, Trash2 } from "lucide-react";
import type { Building } from "@/hooks/useBuildings";

interface Props {
  building: Building;
  onEdit: (b: Building) => void;
  onDelete: (id: string) => void;
}

export function BuildingCard({ building, onEdit, onDelete }: Props) {
  const location = [building.address_neighborhood, building.address_city, building.address_state]
    .filter(Boolean).join(", ");

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{building.name}</h3>
              {building.developer_name && (
                <p className="text-xs text-muted-foreground truncate">{building.developer_name}</p>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(building)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(building.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {location && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{location}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          {building.total_floors && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Layers className="h-3.5 w-3.5" />
              <span>{building.total_floors} andares</span>
            </div>
          )}
          {building.total_units && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Home className="h-3.5 w-3.5" />
              <span>{building.total_units} unidades</span>
            </div>
          )}
          {building.year_built && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{building.year_built}</span>
            </div>
          )}
        </div>

        {building.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {building.amenities.slice(0, 4).map(a => (
              <Badge key={a} variant="secondary" className="text-[10px] px-1.5 py-0">
                {a}
              </Badge>
            ))}
            {building.amenities.length > 4 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{building.amenities.length - 4}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {building.is_public && (
            <Badge variant="default" className="text-[10px]">Público</Badge>
          )}
          <Badge variant={building.status === "active" ? "secondary" : "outline"} className="text-[10px]">
            {building.status === "active" ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
