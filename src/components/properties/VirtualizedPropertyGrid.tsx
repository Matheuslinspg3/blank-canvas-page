import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { SelectablePropertyCard } from "./SelectablePropertyCard";
import type { PropertyWithDetails } from "@/hooks/useProperties";

const ESTIMATED_ROW_HEIGHT = 340;
const OVERSCAN = 3;

interface VirtualizedPropertyGridProps {
  properties: PropertyWithDetails[];
  selectedIds: Set<string>;
  isSelectionMode: boolean;
  publishedIds: Set<string>;
  onSelect: (id: string, selected: boolean) => void;
  onEdit: (property: PropertyWithDetails) => void;
  onDelete: (id: string) => void;
  onPublish?: (id: string) => void;
  onUnpublish?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onChangeStatus?: (id: string, status: string) => void;
  onLongPressSelect: (id: string) => void;
}

function getColumns() {
  if (typeof window === "undefined") return 4;
  const w = window.innerWidth;
  if (w < 640) return 1;
  if (w < 1024) return 2;
  if (w < 1280) return 3;
  return 4;
}

export function VirtualizedPropertyGrid({
  properties,
  selectedIds,
  isSelectionMode,
  publishedIds,
  onSelect,
  onEdit,
  onDelete,
  onPublish,
  onUnpublish,
  onDuplicate,
  onChangeStatus,
  onLongPressSelect,
}: VirtualizedPropertyGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const columns = useMemo(() => getColumns(), []);

  const rows = useMemo(() => {
    const result: PropertyWithDetails[][] = [];
    for (let i = 0; i < properties.length; i += columns) {
      result.push(properties.slice(i, i + columns));
    }
    return result;
  }, [properties, columns]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  return (
    <div ref={parentRef} className="h-[calc(100vh-280px)] overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute top-0 left-0 w-full"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-4">
              {rows[virtualRow.index].map((property) => (
                <SelectablePropertyCard
                  key={property.id}
                  property={property}
                  isSelected={selectedIds.has(property.id)}
                  isSelectionMode={isSelectionMode}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onPublish={onPublish}
                  onUnpublish={onUnpublish}
                  onDuplicate={onDuplicate}
                  onChangeStatus={onChangeStatus}
                  isPublished={publishedIds.has(property.id)}
                  onLongPressSelect={onLongPressSelect}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
