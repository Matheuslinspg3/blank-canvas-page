import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Tags, Loader2, MoreVertical, Pencil, Trash2, Check, X } from "lucide-react";
import {
  usePropertyAmenities,
  useCreateAmenity,
  useUpdateAmenity,
  useDeleteAmenity,
  countAmenityUsage,
  type PropertyAmenity,
} from "@/hooks/usePropertyAmenities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRole";
import { isGlobalAmenity, canEditAmenity, canDeleteAmenity } from "@/lib/amenityPermissions";
import { toast } from "sonner";

interface AmenitiesPickerDialogProps {
  selected: string[];
  onChange: (amenities: string[]) => void;
}

const CATEGORIES = [
  "Lazer", "Vista e Localização", "Infraestrutura", "Mobília",
  "Conveniência", "Tipo de Construção", "Zona Fiscal", "Banheiros", "Geral",
];

export function AmenitiesPickerDialog({ selected, onChange }: AmenitiesPickerDialogProps) {
  const { profile } = useAuth();
  const { isAdminOrAbove } = useUserRoles();
  const isAdminLike = isAdminOrAbove;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Geral");
  const [showCreate, setShowCreate] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("Geral");

  const [deleteTarget, setDeleteTarget] = useState<PropertyAmenity | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<number>(0);
  const [checkingUsage, setCheckingUsage] = useState(false);

  const { data: amenities = [], isLoading } = usePropertyAmenities();
  const createAmenity = useCreateAmenity();
  const updateAmenity = useUpdateAmenity();
  const deleteAmenity = useDeleteAmenity();

  const isGlobal = (a: PropertyAmenity) => a.organization_id === null;
  const canEdit = (a: PropertyAmenity) =>
    !isGlobal(a) && (isAdminLike || a.created_by === profile?.user_id);
  const canDelete = (a: PropertyAmenity) =>
    !isGlobal(a) && !a.is_default && (isAdminLike || a.created_by === profile?.user_id);

  const toggleAmenity = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter((a) => a !== name)
        : [...selected, name]
    );
  };

  const grouped = useMemo(() => {
    const filtered = amenities.filter((a) =>
      a.name.toLowerCase().includes(search.toLowerCase())
    );
    const groups: Record<string, PropertyAmenity[]> = {};
    for (const a of filtered) {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    }
    return groups;
  }, [amenities, search]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const result = await createAmenity.mutateAsync({ name: newName, category: newCategory });
    if (result) {
      onChange([...selected, result.name]);
      setNewName("");
      setShowCreate(false);
    }
  };

  const startEdit = (a: PropertyAmenity) => {
    setEditingId(a.id);
    setEditName(a.name);
    setEditCategory(a.category);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async (a: PropertyAmenity) => {
    if (!editName.trim() || editName.trim() === a.name && editCategory === a.category) {
      cancelEdit();
      return;
    }
    const oldName = a.name;
    const updated = await updateAmenity.mutateAsync({
      id: a.id,
      name: editName,
      category: editCategory,
    });
    if (updated && selected.includes(oldName)) {
      onChange(selected.map((n) => (n === oldName ? updated.name : n)));
    }
    cancelEdit();
  };

  const requestDelete = async (a: PropertyAmenity) => {
    setDeleteTarget(a);
    setCheckingUsage(true);
    try {
      const usage = await countAmenityUsage(a.name);
      setDeleteUsage(usage);
    } catch {
      setDeleteUsage(0);
      toast.error("Não foi possível verificar o uso desta característica");
    } finally {
      setCheckingUsage(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    const removeFromProperties = deleteUsage > 0;
    await deleteAmenity.mutateAsync({
      id: deleteTarget.id,
      name,
      removeFromProperties,
    });
    if (selected.includes(name)) {
      onChange(selected.filter((n) => n !== name));
    }
    setDeleteTarget(null);
    setDeleteUsage(0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2">
          <Tags className="h-4 w-4" />
          <span>Selecionar Características</span>
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{selected.length}</Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            Características do Imóvel
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar características..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Selected summary */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((name) => (
              <Badge
                key={name}
                variant="default"
                className="cursor-pointer gap-1"
                onClick={() => toggleAmenity(name)}
              >
                {name} ×
              </Badge>
            ))}
          </div>
        )}

        {/* Grouped list */}
        <div className="flex-1 min-h-[260px] h-[400px] max-h-[50vh] overflow-y-scroll overflow-x-hidden rounded-md border p-3 pr-2 [scrollbar-gutter:stable]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 pr-1">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {category}
                  </h4>
                  <div className="grid grid-cols-1 gap-1.5">
                    {items.map((amenity) => {
                      const isEditing = editingId === amenity.id;
                      const isMine = amenity.created_by === profile?.user_id && !amenity.is_default;
                      const showActions = canEdit(amenity) || canDelete(amenity);

                      if (isEditing) {
                        return (
                          <div key={amenity.id} className="flex items-center gap-2 p-1.5 rounded-md bg-accent/30">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="h-8 flex-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(amenity);
                                if (e.key === "Escape") cancelEdit();
                              }}
                            />
                            <Select value={editCategory} onValueChange={setEditCategory}>
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIES.map((c) => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => saveEdit(amenity)}
                              disabled={updateAmenity.isPending}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={cancelEdit}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={amenity.id}
                          className="flex items-center gap-2 p-1.5 rounded-md hover:bg-accent/50 transition-colors group"
                        >
                          <label className="flex items-center gap-2 text-sm cursor-pointer flex-1 min-w-0">
                            <Checkbox
                              checked={selected.includes(amenity.name)}
                              onCheckedChange={() => toggleAmenity(amenity.name)}
                            />
                            <span className="truncate">{amenity.name}</span>
                            {amenity.is_default && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 shrink-0">
                                Padrão
                              </Badge>
                            )}
                            {isMine && (
                              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 shrink-0">
                                Minha
                              </Badge>
                            )}
                          </label>
                          {showActions && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canEdit(amenity) && (
                                  <DropdownMenuItem onClick={() => startEdit(amenity)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Editar
                                  </DropdownMenuItem>
                                )}
                                {canDelete(amenity) && (
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => requestDelete(amenity)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Excluir
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {Object.keys(grouped).length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma característica encontrada
                </p>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Create new */}
        {!showCreate ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full gap-2"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-4 w-4" />
            Criar nova característica
          </Button>
        ) : (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Nova Característica</h4>
            <div className="flex gap-2">
              <Input
                placeholder="Nome da característica"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim() || createAmenity.isPending}
              >
                {createAmenity.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Adicionar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => { setShowCreate(false); setNewName(""); }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {checkingUsage ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verificando uso...
                </span>
              ) : deleteUsage > 0 ? (
                <>
                  <strong>{deleteUsage} {deleteUsage === 1 ? "imóvel usa" : "imóveis usam"}</strong> esta característica.
                  Excluir vai removê-la de todos eles. Essa ação não pode ser desfeita.
                </>
              ) : (
                <>Nenhum imóvel usa esta característica. A exclusão é segura.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={checkingUsage || deleteAmenity.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteAmenity.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
