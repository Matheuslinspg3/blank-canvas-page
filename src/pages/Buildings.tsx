import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Building2, Plus, Search } from "lucide-react";
import { useBuildings, type Building } from "@/hooks/useBuildings";
import { BuildingCard } from "@/components/buildings/BuildingCard";
import { BuildingFormDialog } from "@/components/buildings/BuildingFormDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Buildings() {
  const { buildings, isLoading, createBuilding, updateBuilding, deleteBuilding } = useBuildings();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editBuilding, setEditBuilding] = useState<Building | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search) return buildings;
    const q = search.toLowerCase();
    return buildings.filter(b =>
      b.name.toLowerCase().includes(q) ||
      b.developer_name?.toLowerCase().includes(q) ||
      b.address_city?.toLowerCase().includes(q) ||
      b.address_neighborhood?.toLowerCase().includes(q)
    );
  }, [buildings, search]);

  const handleSubmit = (data: any) => {
    if (editBuilding) {
      updateBuilding.mutate({ id: editBuilding.id, ...data }, {
        onSuccess: () => { setFormOpen(false); setEditBuilding(null); },
      });
    } else {
      createBuilding.mutate(data, {
        onSuccess: () => setFormOpen(false),
      });
    }
  };

  const handleEdit = (b: Building) => {
    setEditBuilding(b);
    setFormOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteBuilding.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
    }
  };

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <PageHeader
        title="Edifícios & Empreendimentos"
        description="Catálogo de edifícios e condomínios"
      />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar edifício..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => { setEditBuilding(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Edifício
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="rounded-xl border p-4 space-y-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <CardTitle className="text-lg mb-2">
                {search ? "Nenhum edifício encontrado" : "Cadastre seu primeiro edifício"}
              </CardTitle>
              <CardDescription className="mb-4 text-center">
                {search
                  ? "Tente ajustar sua busca."
                  : "Cadastre edifícios e empreendimentos para vincular aos seus imóveis."}
              </CardDescription>
              {!search && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Novo Edifício
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(b => (
              <BuildingCard key={b.id} building={b} onEdit={handleEdit} onDelete={setDeleteId} />
            ))}
          </div>
        )}
      </div>

      <BuildingFormDialog
        open={formOpen}
        onOpenChange={o => { if (!o) { setFormOpen(false); setEditBuilding(null); } }}
        building={editBuilding}
        onSubmit={handleSubmit}
        isLoading={createBuilding.isPending || updateBuilding.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir edifício?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os imóveis vinculados não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
