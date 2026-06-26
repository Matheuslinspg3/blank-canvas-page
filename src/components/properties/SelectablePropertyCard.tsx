import { useRef, useCallback, memo } from "react";
import { PropertyWithDetails } from "@/hooks/useProperties";
import { PropertyCard } from "./PropertyCard";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PropertyReviewSettings } from "@/hooks/usePropertyReviewSettings";

interface SelectablePropertyCardProps {
  property: PropertyWithDetails;
  isSelected: boolean;
  isSelectionMode: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onEdit: (property: PropertyWithDetails) => void;
  onDelete: (id: string) => void;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onChangeStatus?: (id: string, status: string) => void;
  isPublished?: boolean;
  onLongPressSelect?: (id: string) => void;
  reviewSettings?: PropertyReviewSettings;
}

// PERF: memo prevents re-render of unaffected cards in selection mode
export const SelectablePropertyCard = memo(function SelectablePropertyCard({
  property,
  isSelected,
  isSelectionMode,
  onSelect,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish,
  onDuplicate,
  onChangeStatus,
  isPublished,
  onLongPressSelect,
  reviewSettings,
}: SelectablePropertyCardProps) {
  const isMobile = useIsMobile();
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const handleTouchStart = useCallback(() => {
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      if (onLongPressSelect) {
        onLongPressSelect(property.id);
      } else {
        onSelect(property.id, !isSelected);
      }
    }, 500);
  }, [property.id, isSelected, onSelect, onLongPressSelect]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (isMobile && isSelectionMode && !didLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      onSelect(property.id, !isSelected);
    }
  }, [isMobile, isSelectionMode, property.id, isSelected, onSelect]);

  return (
    <div
      className={cn(
        "relative group transition-all",
        isSelected && "ring-2 ring-primary rounded-lg scale-[0.98]",
        isMobile && isSelectionMode && "active:scale-95"
      )}
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
      onTouchMove={isMobile ? handleTouchMove : undefined}
      onClickCapture={handleCardClick}
    >
      {property.is_draft && (
        <div className="absolute top-3 right-3 z-10 rounded-md bg-amber-500/90 px-2 py-1 text-xs font-semibold text-white shadow-md backdrop-blur-sm">
          Rascunho
          {property.last_editor_name && (
            <span className="ml-1 font-normal opacity-90">· {property.last_editor_name}</span>
          )}
        </div>
      )}
      <div 
        className={cn(
          "absolute top-3 left-3 z-10 transition-all duration-200",
          isSelectionMode
            ? "opacity-100 scale-100"
            : isMobile
              ? "opacity-0 pointer-events-none"
              : "opacity-0 group-hover:opacity-100"
        )}
      >
        <div 
          className={cn(
            "bg-background/90 backdrop-blur-sm rounded-md p-1.5 shadow-md cursor-pointer",
            isSelected && "bg-primary/20"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(property.id, !isSelected);
          }}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(property.id, checked as boolean)}
            className="h-5 w-5"
          />
        </div>
      </div>

      {isMobile && isSelectionMode && (
        <div className={cn(
          "absolute inset-0 z-[5] rounded-lg pointer-events-none transition-colors",
          isSelected ? "bg-primary/10" : "bg-transparent"
        )} />
      )}
      
      <PropertyCard
        property={property}
        onEdit={onEdit}
        onDelete={onDelete}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        onDuplicate={onDuplicate}
        onChangeStatus={onChangeStatus}
        isPublished={isPublished}
        reviewSettings={reviewSettings}
      />
    </div>
  );
});
