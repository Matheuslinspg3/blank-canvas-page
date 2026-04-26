import { useState, useMemo, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, Mail, FileText, Home, Pencil, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { OwnerAliases } from "./OwnerAliases";
import { OwnerPropertyListItem, type OwnerPropertyItem } from "./OwnerPropertyListItem";
import type { OwnerWithDetails } from "@/hooks/useOwners";
import { useAdvancedPropertySearch } from "@/hooks/useAdvancedPropertySearch";
import { defaultFilters, type PropertyFilters } from "@/hooks/usePropertyFilters";
import { useDebounce } from "@/hooks/useDebounce";

interface OwnerDetailsProps {
  owner: OwnerWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (owner: OwnerWithDetails) => void;
}

const PAGE_SIZE = 20;

export function OwnerDetails({ owner, open, onOpenChange, onEdit }: OwnerDetailsProps) {
  // Local toolbar state — does NOT sync with URL
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounce(searchText, 300);

  // Reset state when switching owners or closing
  useEffect(() => {
    setSearchText("");
    setStatusFilter("all");
    setReviewFilter("all");
    setPage(1);
  }, [owner?.id, open]);

  const localFilters = useMemo<PropertyFilters>(
    () => ({
      ...defaultFilters,
      ownerId: owner?.id || "",
      searchText: debouncedSearch,
      status: statusFilter,
      reviewStatus: reviewFilter,
    }),
    [owner?.id, debouncedSearch, statusFilter, reviewFilter]
  );

  const { data, isLoading, isFetching } = useAdvancedPropertySearch(
    localFilters,
    !!owner && open,
    { page, pageSize: PAGE_SIZE, sortBy: "recent" }
  );

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const properties: OwnerPropertyItem[] = (data?.rows ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    property_code: r.property_code,
    status: r.status,
    address_city: r.address_city,
    address_neighborhood: r.address_neighborhood,
    cover_image_url: r.cover_image_url,
    last_reviewed_at: r.last_reviewed_at,
  }));

  if (!owner) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between">
            <span>{owner.primary_name}</span>
            <Button variant="ghost" size="icon" onClick={() => onEdit(owner)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{owner.phone || "—"}</span>
            </div>
            {owner.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{owner.email}</span>
              </div>
            )}
            {owner.document && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>{owner.document}</span>
              </div>
            )}
          </div>

          {owner.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Observações</p>
                <p className="text-sm">{owner.notes}</p>
              </div>
            </>
          )}

          <Separator />

          <OwnerAliases aliases={owner.aliases} primaryName={owner.primary_name} />

          <Separator />

          {/* Linked properties — rich list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Imóveis deste proprietário</p>
              <Badge variant="secondary" className="gap-1">
                <Home className="h-3 w-3" />
                {total || owner.property_count}
              </Badge>
            </div>

            {/* Mini-toolbar — local state */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="relative sm:col-span-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar título/código"
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 pl-7 text-sm"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                  <SelectItem value="vendido">Vendido</SelectItem>
                  <SelectItem value="alugado">Alugado</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={reviewFilter} onValueChange={(v) => { setReviewFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda revisão</SelectItem>
                  <SelectItem value="overdue_30">Sem revisão +30d</SelectItem>
                  <SelectItem value="overdue_60">Sem revisão +60d</SelectItem>
                  <SelectItem value="never">Nunca revisados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-40" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            ) : properties.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum imóvel encontrado para este proprietário.
              </p>
            ) : (
              <>
                <div className={`space-y-2 ${isFetching ? "opacity-70" : ""}`}>
                  {properties.map((prop) => (
                    <OwnerPropertyListItem
                      key={prop.id}
                      property={prop}
                      onNavigate={() => onOpenChange(false)}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">
                      Página {page} de {totalPages} · {total} imóve{total === 1 ? "l" : "is"}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || isFetching}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || isFetching}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
