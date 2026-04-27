import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from "react";
import { findDuplicateProperties, DuplicatePropertyMatch } from "@/lib/duplicatePropertyDetector";
import type { DuplicateCandidate } from "@/components/properties/DuplicateReviewDialog";
import { useNavigate, useLocation } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, FileUp } from "lucide-react";
import { QueryErrorState } from "@/components/QueryErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { useProperties, PropertyWithDetails, PropertyFormData } from "@/hooks/useProperties";
import { usePropertiesList } from "@/hooks/usePropertiesList";
import { SelectablePropertyCard } from "@/components/properties/SelectablePropertyCard";
import { VirtualizedPropertyGrid } from "@/components/properties/VirtualizedPropertyGrid";
import { PropertyListItem } from "@/components/properties/PropertyListItem";
import { VirtualizedPropertyList } from "@/components/properties/VirtualizedPropertyList";
import { PropertyEmptyState } from "@/components/properties/PropertyEmptyState";
import { BulkActionsToolbar } from "@/components/properties/BulkActionsToolbar";
import { UnifiedPropertySearch } from "@/components/properties/UnifiedPropertySearch";
import { PropertyFilters } from "@/components/properties/PropertyFilters";
import { SavedSearchManager } from "@/components/properties/SavedSearchManager";
import { PropertyViewControls, ViewMode, PageSize, SortOption } from "@/components/properties/PropertyViewControls";
import { PropertyStatusStats } from "@/components/properties/PropertyStatusStats";
import { usePropertyFilters } from "@/hooks/usePropertyFilters";
import { useAdvancedPropertySearch } from "@/hooks/useAdvancedPropertySearch";
import { usePropertyReviewSettings } from "@/hooks/usePropertyReviewSettings";
import { useMarketplaceStatus } from "@/hooks/useMarketplaceStatus";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ExtractedPropertyData } from "@/components/properties/PdfImportDialog";
import { ImportReviewBanner } from "@/components/properties/ImportReviewBanner";

// PERF: lazy load - PropertyMapView imports leaflet (~40KB), only needed when map view selected
const PropertyMapView = lazy(() => import("@/components/properties/PropertyMapView").then(m => ({ default: m.PropertyMapView })));
// PERF: lazy load - PropertyForm is ~800 lines + sub-tabs, only needed when creating/editing
const PropertyForm = lazy(() => import("@/components/properties/PropertyForm").then(m => ({ default: m.PropertyForm })));
// PERF: lazy load - PdfImportDialog only needed when user clicks import
const PdfImportDialog = lazy(() => import("@/components/properties/PdfImportDialog").then(m => ({ default: m.PdfImportDialog })));
// PERF: lazy load - Duplicate dialogs only needed when duplicates detected
const DuplicatePropertyDialog = lazy(() => import("@/components/properties/DuplicatePropertyDialog").then(m => ({ default: m.DuplicatePropertyDialog })));
const DuplicateReviewDialog = lazy(() => import("@/components/properties/DuplicateReviewDialog").then(m => ({ default: m.DuplicateReviewDialog })));
import { usePropertyTypes } from "@/hooks/usePropertyTypes";
import { toast } from "sonner";
// useImageUpload still used by PropertyForm; keep import but don't destructure for scraper
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PropertyImage {
  id?: string;
  url: string;
  path?: string;
  is_cover?: boolean;
  display_order?: number;
}

export default function Properties() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<PropertyWithDetails | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [pdfImportOpen, setPdfImportOpen] = useState(false);
  const [prefillData, setPrefillData] = useState<Record<string, any> | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [foundDuplicates, setFoundDuplicates] = useState<DuplicatePropertyMatch[]>([]);
  const [duplicateReviewOpen, setDuplicateReviewOpen] = useState(false);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);
  const [duplicateImportedCount, setDuplicateImportedCount] = useState(0);
  const pendingBatchRef = useRef<{ items: ExtractedPropertyData[]; pdfFileName?: string } | null>(null);
  const pendingSubmitRef = useRef<{ data: PropertyFormData; images: PropertyImage[]; ownerData?: any; publishMarketplace?: boolean } | null>(null);
  const { propertyTypes } = usePropertyTypes();
  

  const {
    filters, updateFilter, updateFilters, clearFilters, hasActiveFilters, activeFilterCount, neighborhoods, cities, availableAmenities,
  } = usePropertyFilters();

  // Advanced RPC search runs ONLY when there are active filters.
  // Without filters we use the lightweight paginated list directly.
  const { data: searchData, isLoading: isSearching, isFetching: isSearchFetching } = useAdvancedPropertySearch(
    filters,
    hasActiveFilters,
    { page: currentPage, pageSize: pageSize === 'all' ? 2000 : pageSize, sortBy }
  );
  const searchResults = searchData?.rows;
  // PERF: load review-settings ONCE for the page and pass down to badges to avoid N+1
  const { settings: reviewSettings } = usePropertyReviewSettings();
  const searchTotal = searchData?.total ?? 0;

  // Lightweight listing for the page (cards only, server-paginated, cover image only).
  // Owner is passed as a fallback path; the primary owner filter goes through the RPC
  // when any advanced filter is active.
  const { properties: listProperties, total: listTotal, isLoading: isLoadingList, isFetching: isListFetching } = usePropertiesList({
    pageSize: pageSize === 'all' ? 2000 : pageSize,
    page: currentPage,
    sortBy,
    enabled: !hasActiveFilters,
    ownerId: filters.ownerId || null,
  });

  // Full hook kept for mutations + bulk ops. The heavy listing query is NEVER
  // used for listing — only mutations.
  const {
    isLoading: isLoadingFull, error: propertiesError, createProperty, updateProperty, deleteProperty,
    bulkDeleteProperties, bulkInactivateProperties, publishToMarketplace,
    bulkPublishToMarketplace, bulkHideFromMarketplace, hideFromMarketplace,
    isCreating, isUpdating, isDeleting, isBulkDeleting, isBulkInactivating,
    isBulkPublishing, isBulkHiding, refetch,
  } = useProperties({ enabled: false });

  // `allProperties` = whichever dataset is currently driving the UI.
  const allProperties = hasActiveFilters
    ? (searchResults ?? []).map(result => ({
        id: result.id, property_code: result.property_code, title: result.title,
        description: result.description, address_city: result.address_city,
        address_neighborhood: result.address_neighborhood, address_state: result.address_state,
        sale_price: result.sale_price, rent_price: result.rent_price, bedrooms: result.bedrooms,
        bathrooms: result.bathrooms, parking_spots: result.parking_spots, area_total: result.area_total,
        area_built: result.area_built, status: result.status, transaction_type: result.transaction_type,
        property_type_id: result.property_type_id, created_at: result.created_at, updated_at: result.updated_at,
        last_reviewed_at: result.last_reviewed_at,
        beach_distance_meters: result.beach_distance_meters,
        images: result.cover_image_url ? [{ url: result.cover_image_url, is_cover: true, display_order: 0 }] : [],
      } as PropertyWithDetails))
    : listProperties;
  const totalCount = hasActiveFilters ? searchTotal : listTotal;
  const isLoadingAll = hasActiveFilters ? isSearching : isLoadingList;

  const { publishedIds, refetch: refetchPublishedIds } = useMarketplaceStatus();

  // Owner filter is now applied server-side inside the RPC (search_properties_advanced)
  // and as a robust fallback inside usePropertiesList. No client-side filtering needed.

  // Handle edit from PropertyDetails navigation
  useEffect(() => {
    const editId = (location.state as any)?.editPropertyId;
    if (editId && allProperties.length > 0) {
      const prop = allProperties.find(p => p.id === editId);
      if (prop) {
        setEditingProperty(prop);
        setFormOpen(true);
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, allProperties, navigate, location.pathname]);

  // Listen for FAB actions
  useEffect(() => {
    const handler = (e: Event) => {
      const action = (e as CustomEvent).detail?.action;
      if (action === "new-property") handleCreateClick();
      if (action === "import-pdf") setPdfImportOpen(true);
    };
    window.addEventListener("fab-action", handler);
    return () => window.removeEventListener("fab-action", handler);
  }, []);

  const handlePdfDataExtracted = useCallback((data: ExtractedPropertyData, pdfFileName?: string) => {
    const matchedType = data.property_type
      ? propertyTypes.find(t => t.name.toLowerCase() === data.property_type!.toLowerCase())
      : undefined;

    setPrefillData({
      property_type_id: matchedType?.id || null,
      transaction_type: data.transaction_type || "venda",
      property_condition: data.property_condition || null,
      development_name: data.development_name || null,
      sale_price: data.sale_price || null,
      sale_price_financed: data.sale_price_financed || null,
      rent_price: data.rent_price || null,
      condominium_fee: data.condominium_fee || null,
      iptu: data.iptu || null,
      bedrooms: data.bedrooms ?? 0,
      suites: data.suites ?? 0,
      bathrooms: data.bathrooms ?? 0,
      parking_spots: data.parking_spots ?? 0,
      area_total: data.area_total || null,
      area_built: data.area_built || null,
      area_useful: data.area_useful || null,
      floor: data.floor || null,
      beach_distance_meters: data.beach_distance_meters || null,
      address_zipcode: data.address_zipcode || "",
      address_street: data.address_street || "",
      address_number: data.address_number || "",
      address_complement: data.address_complement || "",
      address_neighborhood: data.address_neighborhood || "",
      address_city: data.address_city || "",
      address_state: data.address_state || "",
      description: data.description || "",
      amenities: data.amenities || [],
      owner_name: data.owner_name || "",
      owner_phone: data.owner_phone || "",
      owner_email: data.owner_email || "",
      source_provider: "pdf",
      source_code: pdfFileName || null,
    });
    setEditingProperty(null);
    setFormOpen(true);
  }, [propertyTypes]);

  const scrapeAndSavePhotoRefs = useCallback(async (
    items: { propertyId: string; photosUrl: string; label: string }[]
  ) => {
    let totalSaved = 0;

    toast.loading(`Vinculando fotos de ${items.length} imóveis...`, { id: "photo-scrape" });

    for (let i = 0; i < items.length; i++) {
      const { propertyId, photosUrl, label } = items[i];
      try {
        toast.loading(`Processando fotos: ${label} (${i + 1}/${items.length})...`, { id: "photo-scrape" });

        // Reference mode: saves Drive thumbnail URLs (zero storage, served via proxy)
        const { data, error } = await supabase.functions.invoke("scrape-drive-photos", {
          body: { url: photosUrl, property_id: propertyId, max_photos: 20, mode: "reference" },
        });

        if (error) {
          console.warn(`Erro ao buscar fotos de ${label}:`, error);
          continue;
        }

        if (data?.saved) {
          totalSaved += data.saved;
        } else if (data?.error) {
          console.warn(`Sem fotos para ${label}:`, data.error);
        }
      } catch (err) {
        console.error(`Erro ao buscar fotos de ${label}:`, err);
      }
    }

    toast.dismiss("photo-scrape");
    if (totalSaved > 0) {
      toast.success(`${totalSaved} fotos vinculadas com sucesso!`);
    } else {
      toast.info("Nenhuma foto encontrada nas pastas do Drive.");
    }
  }, []);

  const handlePdfBatchExtracted = useCallback(async (items: ExtractedPropertyData[], pdfFileName?: string) => {
    // Phase 1: Check all items for duplicates
    toast.loading('Verificando duplicatas...', { id: 'dup-check' });
    const duplicates: DuplicateCandidate[] = [];
    const nonDuplicateIndices: number[] = [];

    for (let i = 0; i < items.length; i++) {
      const data = items[i];
      if (data.address_street) {
        const matches = await findDuplicateProperties(data.address_street, data.address_number, undefined, data.address_complement);
        if (matches.length > 0) {
          duplicates.push({
            index: i,
            label: data.unit_identifier || `Imóvel ${i + 1}`,
            address: [data.address_street, data.address_number].filter(Boolean).join(', '),
            complement: data.address_complement || '',
            matches,
          });
          continue;
        }
      }
      nonDuplicateIndices.push(i);
    }
    toast.dismiss('dup-check');

    // Phase 2: Import non-duplicates immediately
    let importedCount = 0;
    if (nonDuplicateIndices.length > 0) {
      importedCount = await executeBatchImport(items, nonDuplicateIndices, pdfFileName, duplicates.length > 0);
    }

    // Phase 3: If duplicates found, show review dialog
    if (duplicates.length > 0) {
      pendingBatchRef.current = { items, pdfFileName };
      setDuplicateImportedCount(importedCount);
      setDuplicateCandidates(duplicates);
      setDuplicateReviewOpen(true);
      return;
    }

    if (importedCount === 0) {
      toast.info('Nenhum imóvel para importar.');
    }
  }, [propertyTypes, createProperty]);

  const executeBatchImport = useCallback(async (
    items: ExtractedPropertyData[],
    indicesToImport: number[],
    pdfFileName?: string,
    silent?: boolean,
  ): Promise<number> => {
    let success = 0;
    let errors = 0;
    const propertiesWithPhotos: { propertyId: string; photosUrl: string; label: string }[] = [];

    for (const i of indicesToImport) {
      const data = items[i];
      const matchedType = data.property_type
        ? propertyTypes.find(t => t.name.toLowerCase() === data.property_type!.toLowerCase())
        : undefined;

      const formData: any = {
        property_type_id: matchedType?.id || null,
        transaction_type: data.transaction_type || "venda",
        property_condition: data.property_condition || null,
        development_name: data.development_name || null,
        sale_price: data.sale_price || null,
        sale_price_financed: data.sale_price_financed || null,
        rent_price: data.rent_price || null,
        condominium_fee: data.condominium_fee || null,
        iptu: data.iptu || null,
        bedrooms: data.bedrooms ?? 0,
        suites: data.suites ?? 0,
        bathrooms: data.bathrooms ?? 0,
        parking_spots: data.parking_spots ?? 0,
        area_total: data.area_total || null,
        area_built: data.area_built || null,
        area_useful: data.area_useful || null,
        floor: data.floor || null,
        beach_distance_meters: data.beach_distance_meters || null,
        address_zipcode: data.address_zipcode || "",
        address_street: data.address_street || "",
        address_number: data.address_number || "",
        address_complement: data.address_complement || "",
        address_neighborhood: data.address_neighborhood || "",
        address_city: data.address_city || "",
        address_state: data.address_state || "",
        description: data.description || "",
        amenities: data.amenities || [],
        title: [data.property_type, data.unit_identifier, data.development_name].filter(Boolean).join(" - ") || undefined,
        source_provider: "pdf",
        source_code: pdfFileName || null,
      };

      const ownerData = (data.owner_name || data.owner_phone || data.owner_email)
        ? { name: data.owner_name, phone: data.owner_phone, email: data.owner_email }
        : undefined;

      try {
        toast.loading(`Importando ${indicesToImport.indexOf(i) + 1}/${indicesToImport.length}...`, { id: "batch-import" });
        const result = await createProperty(formData, [], ownerData);
        success++;
        if (data.photos_url && result?.id) {
          propertiesWithPhotos.push({
            propertyId: result.id,
            photosUrl: data.photos_url,
            label: data.unit_identifier || `Imóvel ${i + 1}`,
          });
        }
      } catch {
        errors++;
      }
    }

    toast.dismiss("batch-import");

    if (!silent) {
      if (errors === 0) {
        toast.success(`${success} ${success === 1 ? "imóvel importado" : "imóveis importados"} com sucesso!`);
      } else {
        toast.warning(`${success} importados, ${errors} com erro.`);
      }
    }

    if (propertiesWithPhotos.length > 0) {
      scrapeAndSavePhotoRefs(propertiesWithPhotos);
    }

    return success;
  }, [propertyTypes, createProperty]);

  const handleDuplicateReviewConfirm = useCallback(async (selectedIndices: number[]) => {
    setDuplicateReviewOpen(false);
    if (!pendingBatchRef.current) return;

    const { items, pdfFileName } = pendingBatchRef.current;
    pendingBatchRef.current = null;

    if (selectedIndices.length > 0) {
      await executeBatchImport(items, selectedIndices, pdfFileName);
    }
  }, [executeBatchImport]);

  const handleDuplicateReviewCancel = useCallback(async () => {
    setDuplicateReviewOpen(false);
    pendingBatchRef.current = null;
  }, []);
  // Owner filter is enforced server-side; no extra client filtering needed.
  const filteredProperties = allProperties;

  // Server-side sort/pagination is now handled by the hooks.
  // No client-side sort or pagination needed.
  const paginatedProperties = filteredProperties;

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filters]);

  const isLoading = isSearching || isLoadingAll;
  const isFetching = isSearchFetching || isListFetching;

  const handlePropertySelect = useCallback((result: { id: string }) => {
    navigate(`/imoveis/${result.id}`);
  }, [navigate]);

  const handleTextSearch = useCallback((text: string) => {
    updateFilter('searchText', text);
  }, [updateFilter]);

  const handleNeighborhoodFilter = useCallback((neighborhood: string) => {
    updateFilter('neighborhoods', neighborhood ? [neighborhood] : []);
  }, [updateFilter]);

  const handleCityFilter = useCallback((city: string) => {
    updateFilter('cities', city ? [city] : []);
  }, [updateFilter]);

  const handleLoadSavedSearch = useCallback((savedFilters: any) => {
    updateFilters(savedFilters);
  }, [updateFilters]);

  const handleSelectProperty = useCallback((id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      selected ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  // Long-press on mobile enters selection mode and selects the property
  const handleLongPressSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(async () => {
    // Fetch ALL property IDs from the server (not just the current page)
    if (!profile?.organization_id) return;

    if (hasActiveFilters) {
      // When filters are active, re-run the RPC with a large limit to get all matching IDs
      const { data } = await supabase.rpc('search_properties_advanced', {
        p_organization_id: profile.organization_id,
        p_search_text: filters.searchText || null,
        p_transaction_type: filters.transactionType === 'all' ? null : filters.transactionType,
        p_status: filters.status === 'all' ? null : filters.status,
        p_property_type_id: filters.propertyTypeId === 'all' ? null : filters.propertyTypeId,
        p_min_price: filters.minPrice,
        p_max_price: filters.maxPrice,
        p_min_bedrooms: filters.minBedrooms,
        p_neighborhood: null,
        p_city: null,
        p_neighborhoods: filters.neighborhoods.length > 0 ? filters.neighborhoods : null,
        p_cities: filters.cities.length > 0 ? filters.cities : null,
        p_min_area: filters.minArea,
        p_limit: 10000,
        p_offset: 0,
        p_min_suites: filters.minSuites,
        p_min_parking: filters.minParking,
        p_max_area: filters.maxArea,
        p_min_condominium: filters.minCondominium,
        p_max_condominium: filters.maxCondominium,
        p_amenities: (() => {
          const ams = [...filters.amenities];
          if (filters.frenteMar && !ams.includes('Frente Mar')) ams.push('Frente Mar');
          return ams.length > 0 ? ams : null;
        })(),
        p_property_condition: filters.propertyCondition === 'all' ? null : filters.propertyCondition,
        p_max_beach_distance: filters.maxBeachDistance,
        p_launch_stage: filters.launchStage === 'all' ? null : filters.launchStage,
        p_sort_by: 'recent',
        p_owner_id: filters.ownerId || null,
      });
      if (data) {
        const ids = (data as any[]).map((r: any) => r.id as string);
        setSelectedIds(new Set(ids));
      }
    } else {
      // No filters: fetch all IDs with a lightweight query
      const { data } = await supabase
        .from('properties')
        .select('id')
        .eq('organization_id', profile.organization_id);
      if (data) {
        setSelectedIds(new Set(data.map(d => d.id)));
      }
    }
  }, [profile?.organization_id, hasActiveFilters, filters]);

  const handleClearSelection = useCallback(() => { setSelectedIds(new Set()); }, []);

  const handleBulkDelete = useCallback(async () => {
    await bulkDeleteProperties(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, bulkDeleteProperties]);

  const handleBulkInactivate = useCallback(async () => {
    await bulkInactivateProperties(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, bulkInactivateProperties]);

  const handleBulkPublishMarketplace = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    // Fire-and-forget: run in background
    bulkPublishToMarketplace(ids).catch(() => {});
  }, [selectedIds, bulkPublishToMarketplace]);

  const handleBulkHideMarketplace = useCallback(async () => {
    await bulkHideFromMarketplace(Array.from(selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, bulkHideFromMarketplace]);

  const isSelectionMode = selectedIds.size > 0;
  const allSelected = totalCount > 0 && selectedIds.size >= totalCount;

  // PERF: useCallback stabilizes handlers passed as props to memoized list items
  const handleCreateClick = useCallback(() => { setEditingProperty(null); setPrefillData(null); setFormOpen(true); }, []);
  const handleEditClick = useCallback((property: PropertyWithDetails) => {
    // Refresh marketplace status so the toggle reflects the actual DB state.
    refetchPublishedIds();
    setEditingProperty(property); setPrefillData(null); setFormOpen(true);
  }, [refetchPublishedIds]);
  const handleDeleteClick = useCallback((id: string) => { setDeleteId(id); }, []);

  const handlePublishSingle = useCallback(async (id: string) => {
    try {
      await publishToMarketplace(id);
      refetchPublishedIds();
      toast.success("Imóvel publicado no Marketplace");
    } catch (err: any) {
      toast.error("Erro ao publicar", { description: err?.message });
    }
  }, [publishToMarketplace, refetchPublishedIds]);

  const handleUnpublishSingle = useCallback(async (id: string) => {
    try {
      await hideFromMarketplace(id);
      refetchPublishedIds();
      toast.success("Imóvel removido do Marketplace");
    } catch (err: any) {
      toast.error("Erro ao remover", { description: err?.message });
    }
  }, [hideFromMarketplace, refetchPublishedIds]);

  const handleDuplicate = useCallback((id: string) => {
    navigate(`/imoveis/${id}?duplicate=true`);
  }, [navigate]);

  const handleChangeStatus = useCallback(async (id: string, status: string) => {
    try {
      await updateProperty(id, { status } as any, []);
      toast.success(`Status alterado para ${status}`);
    } catch (err: any) {
      toast.error("Erro ao alterar status", { description: err?.message });
    }
  }, [updateProperty]);

  const handleConfirmDelete = async () => {
    if (deleteId) { await deleteProperty(deleteId); setDeleteId(null); }
  };

  const executePropertySubmit = useCallback(async (data: PropertyFormData, images: PropertyImage[], ownerData?: any, publishMarketplace?: boolean) => {
    let propertyId: string | undefined;
    const wasPublished = editingProperty ? publishedIds.has(editingProperty.id) : false;

    if (editingProperty) {
      await updateProperty(editingProperty.id, data, images, ownerData);
      propertyId = editingProperty.id;
    } else {
      const result = await createProperty(data, images, ownerData);
      propertyId = result?.id;
    }
    if (!propertyId) return;

    // Explicit publish/unpublish semantics with surfaced errors.
    try {
      if (publishMarketplace) {
        // ON → publish (insert) or re-sync (update). Same upsert handles both.
        await publishToMarketplace(propertyId);
      } else if (wasPublished) {
        // OFF + previously published → confirm + unpublish.
        const ok = window.confirm(
          'Você desativou a publicação no Marketplace. Deseja remover este imóvel do Marketplace agora?'
        );
        if (ok) {
          await hideFromMarketplace(propertyId);
        }
      }
      // OFF + not published → no-op.
    } catch (err: any) {
      toast.error('Erro ao sincronizar Marketplace', {
        description: err?.message || 'Verifique o telefone público da imobiliária e tente novamente.',
      });
    }
    refetchPublishedIds();
  }, [editingProperty, updateProperty, createProperty, publishToMarketplace, hideFromMarketplace, publishedIds, refetchPublishedIds]);

  const handleFormSubmit = async (data: PropertyFormData, images: PropertyImage[], ownerData?: { name?: string; phone?: string; email?: string; document?: string; notes?: string }, publishMarketplace?: boolean) => {
    // Only check duplicates for new properties (not edits)
    if (!editingProperty) {
      const street = (data as any).address_street;
      const number = (data as any).address_number;
      if (street) {
        const duplicates = await findDuplicateProperties(street, number);
        if (duplicates.length > 0) {
          pendingSubmitRef.current = { data, images, ownerData, publishMarketplace };
          setFoundDuplicates(duplicates);
          setDuplicateDialogOpen(true);
          return; // Wait for user confirmation
        }
      }
    }
    await executePropertySubmit(data, images, ownerData, publishMarketplace);
  };

  const handleDuplicateConfirm = useCallback(async () => {
    setDuplicateDialogOpen(false);
    if (pendingSubmitRef.current) {
      const { data, images, ownerData, publishMarketplace } = pendingSubmitRef.current;
      pendingSubmitRef.current = null;
      await executePropertySubmit(data, images, ownerData, publishMarketplace);
    }
  }, [executePropertySubmit]);

  const handleDuplicateCancel = useCallback(() => {
    setDuplicateDialogOpen(false);
    pendingSubmitRef.current = null;
  }, []);

  return (
    <div className="flex flex-col min-h-screen relative page-enter">
      <div className="absolute inset-0 bg-gradient-mesh-vibrant pointer-events-none" />
      <PageHeader
        title="Imóveis"
        description="Gerencie seu portfólio de imóveis"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setPdfImportOpen(true)} className="hidden sm:flex">
              <FileUp className="h-4 w-4 mr-2" /> Importar PDF
            </Button>
            <Button onClick={handleCreateClick}>
              <Plus className="h-4 w-4 mr-2" /> Novo Imóvel
            </Button>
          </div>
        }
      />

      <div className="relative flex-1 p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <UnifiedPropertySearch
                  onSelect={handlePropertySelect}
                  onTextSearch={handleTextSearch}
                  onNeighborhoodFilter={handleNeighborhoodFilter}
                  onCityFilter={handleCityFilter}
                  placeholder="Buscar por código, título, bairro..."
                />
              </div>
              <PropertyFilters
                filters={filters}
                onUpdateFilter={updateFilter}
                onUpdateFilters={updateFilters}
                onClearFilters={clearFilters}
                activeFilterCount={activeFilterCount}
                neighborhoods={neighborhoods}
                cities={cities}
                availableAmenities={availableAmenities}
              />
              <SavedSearchManager
                currentFilters={filters}
                onLoadSearch={handleLoadSavedSearch}
                hasActiveFilters={hasActiveFilters}
              />
            </div>
          </CardContent>
        </Card>

        {/* Import Review Banner */}
        <ImportReviewBanner />

        {/* Status Stats */}
        {!isLoading && allProperties.length > 0 && (
          <PropertyStatusStats
            properties={allProperties}
            onFilterByStatus={(status) => updateFilter('status', status)}
            activeStatus={filters.status}
          />
        )}

        {/* View Controls */}
        {!isLoading && filteredProperties.length > 0 && (
          <PropertyViewControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            totalCount={totalCount}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-video w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && allProperties.length === 0 && (
          <PropertyEmptyState onCreateClick={handleCreateClick} />
        )}

        {!isLoading && allProperties.length > 0 && filteredProperties.length === 0 && (
          <PropertyEmptyState onCreateClick={handleCreateClick} filtered />
        )}

        {/* Bulk Actions */}
        {!isLoading && filteredProperties.length > 0 && (
          <BulkActionsToolbar
            selectedCount={selectedIds.size}
            totalCount={totalCount}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onBulkDelete={handleBulkDelete}
            onBulkInactivate={handleBulkInactivate}
            onBulkPublishMarketplace={handleBulkPublishMarketplace}
            onBulkHideMarketplace={handleBulkHideMarketplace}
            isDeleting={isBulkDeleting}
            isInactivating={isBulkInactivating}
            isPublishing={isBulkPublishing}
            isHiding={isBulkHiding}
            allSelected={allSelected}
          />
        )}

        {/* Properties View */}
        {propertiesError && (
          <QueryErrorState message="Erro ao carregar imóveis" onRetry={() => refetch()} />
        )}
        {!propertiesError && !isLoading && paginatedProperties.length > 0 && (
          <div className={isFetching ? 'opacity-60 transition-opacity duration-200' : 'transition-opacity duration-200'}>
            {viewMode === "grid" && (
              <VirtualizedPropertyGrid
                properties={paginatedProperties}
                selectedIds={selectedIds}
                isSelectionMode={isSelectionMode}
                publishedIds={publishedIds}
                onSelect={handleSelectProperty}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                onPublish={handlePublishSingle}
                onUnpublish={handleUnpublishSingle}
                onDuplicate={handleDuplicate}
                onChangeStatus={handleChangeStatus}
                onLongPressSelect={handleLongPressSelect}
                reviewSettings={reviewSettings}
              />
            )}

            {viewMode === "list" && (
              <VirtualizedPropertyList
                properties={paginatedProperties}
                selectedIds={selectedIds}
                isSelectionMode={isSelectionMode}
                publishedIds={publishedIds}
                onSelect={handleSelectProperty}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
                onDuplicate={handleDuplicate}
                onPublish={handlePublishSingle}
                onUnpublish={handleUnpublishSingle}
                onChangeStatus={handleChangeStatus}
                reviewSettings={reviewSettings}
              />
            )}

            {viewMode === "map" && (
              <Suspense fallback={<Skeleton className="h-[500px] w-full rounded-xl" />}>
                <PropertyMapView 
                  properties={paginatedProperties} 
                  onPropertyClick={(p) => navigate(`/imoveis/${p.id}`)}
                  onRefresh={() => refetch()}
                />
              </Suspense>
            )}
          </div>
        )}

        {/* Bottom Pagination */}
        {!isLoading && totalCount > 0 && pageSize !== "all" && (
          <PropertyViewControls
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            totalCount={totalCount}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
        )}
      </div>

      <Suspense fallback={null}>
        <PropertyForm
          open={formOpen}
          onOpenChange={setFormOpen}
          property={editingProperty}
          onSubmit={handleFormSubmit}
          isSubmitting={isCreating || isUpdating}
          prefillData={prefillData}
          isPublished={editingProperty ? publishedIds.has(editingProperty.id) : false}
        />
      </Suspense>

      <Suspense fallback={null}>
        <PdfImportDialog
          open={pdfImportOpen}
          onOpenChange={setPdfImportOpen}
          onDataExtracted={handlePdfDataExtracted}
          onBatchExtracted={handlePdfBatchExtracted}
        />
      </Suspense>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imóvel</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este imóvel? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Suspense fallback={null}>
        <DuplicatePropertyDialog
          open={duplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
          duplicates={foundDuplicates}
          onConfirm={handleDuplicateConfirm}
          onCancel={handleDuplicateCancel}
        />
      </Suspense>

      <Suspense fallback={null}>
        <DuplicateReviewDialog
          open={duplicateReviewOpen}
          candidates={duplicateCandidates}
          importedCount={duplicateImportedCount}
          onConfirm={handleDuplicateReviewConfirm}
          onCancel={handleDuplicateReviewCancel}
        />
      </Suspense>
    </div>
  );
}
