import { useRef, useState, useCallback } from "react";
import { X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PdfFieldPosition } from "./types";

interface DraggableFieldProps {
  field: PdfFieldPosition;
  containerWidth: number;
  containerHeight: number;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onRemove: () => void;
}

export function DraggableField({
  field, containerWidth, containerHeight, selected, onSelect, onMove, onResize, onRemove,
}: DraggableFieldProps) {
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0, fieldX: 0, fieldY: 0 });

  const left = (field.x / 100) * containerWidth;
  const top = (field.y / 100) * containerHeight;
  const w = (field.width / 100) * containerWidth;
  const h = (field.height / 100) * containerHeight;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    setDragging(true);
    startRef.current = { x: e.clientX, y: e.clientY, fieldX: field.x, fieldY: field.y };

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startRef.current.x;
      const dy = ev.clientY - startRef.current.y;
      const newX = startRef.current.fieldX + (dx / containerWidth) * 100;
      const newY = startRef.current.fieldY + (dy / containerHeight) * 100;
      onMove(
        Math.max(0, Math.min(100 - field.width, newX)),
        Math.max(0, Math.min(100 - field.height, newY))
      );
    };

    const handleMouseUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [field, containerWidth, containerHeight, onSelect, onMove]);

  const isSignature = field.variable.includes("assinatura");

  return (
    <div
      className={cn(
        "absolute group cursor-move select-none rounded border-2 transition-colors",
        selected
          ? "border-primary bg-primary/20 z-20"
          : "border-primary/50 bg-primary/10 hover:border-primary z-10",
        dragging && "opacity-75",
        isSignature && "border-dashed"
      )}
      style={{ left, top, width: w, height: h }}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className="absolute inset-0 flex items-center justify-center px-1 overflow-hidden">
        <span className="text-[10px] font-medium text-primary truncate leading-tight text-center">
          {field.label}
        </span>
      </div>
      {selected && (
        <button
          className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center z-30 hover:scale-110 transition-transform"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
      <GripVertical className="absolute top-0.5 left-0.5 h-3 w-3 text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
