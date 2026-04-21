import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PropertyListItem } from "./PropertyListItem";
import type { PropertyWithDetails } from "@/hooks/useProperties";

const ESTIMATED_ITEM_HEIGHT = 72;
const OVERSCAN = 3;

interface VirtualizedPropertyListProps {
  properties: PropertyWithDetails[];
  selectedIds: Set<string>;
  isSelectionMode: boolean;
  publishedIds: Set<string>;
  onSelect: (id: string, selected: boolean) => void;
  onEdit: (property: PropertyWithDetails) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  onChangeStatus?: (id: string, status: string) => void;
}

export function VirtualizedPropertyList({
  properties,
  selectedIds,
  isSelectionMode,
  publishedIds,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onPublish,
  onUnpublish,
  onChangeStatus,
}: VirtualizedPropertyListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: properties.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: OVERSCAN,
  });

  return (
    <div ref={parentRef} className="h-[calc(100vh-280px)] overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const property = properties[virtualItem.index];
          return (
            <div
              key={property.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full pb-2"
              style={{ transform: `translateY(${virtualItem.start}px)` }}
            >
              <PropertyListItem
                property={property}
                isSelected={selectedIds.has(property.id)}
                isSelectionMode={isSelectionMode}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onPublish={onPublish}
                onUnpublish={onUnpublish}
                onChangeStatus={onChangeStatus}
                isPublished={publishedIds.has(property.id)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
