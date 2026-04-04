import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import type { Building, BuildingFormData } from "@/hooks/useBuildings";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  building?: Building | null;
  onSubmit: (data: Partial<BuildingFormData>) => void;
  isLoading?: boolean;
}

const AMENITY_OPTIONS = [
  "Piscina", "Academia", "Salão de Festas", "Churrasqueira", "Playground",
  "Quadra Esportiva", "Sauna", "Spa", "Brinquedoteca", "Coworking",
  "Pet Place", "Lavanderia", "Portaria 24h", "Elevador", "Garagem",
  "Rooftop", "Cinema", "Espaço Gourmet", "Jardim",
];

export function BuildingFormDialog({ open, onOpenChange, building, onSubmit, isLoading }: Props) {
  const [form, setForm] = useState<Partial<BuildingFormData>>({
    name: "", developer_name: "", address_street: "", address_number: "",
    address_neighborhood: "", address_city: "", address_state: "", address_zip: "",
    year_built: null, total_floors: null, total_units: null, description: "",
    amenities: [], is_public: false, status: "active",
  });

  useEffect(() => {
    if (building) {
      setForm({
        name: building.name, developer_name: building.developer_name || "",
        address_street: building.address_street || "", address_number: building.address_number || "",
        address_neighborhood: building.address_neighborhood || "", address_city: building.address_city || "",
        address_state: building.address_state || "", address_zip: building.address_zip || "",
        year_built: building.year_built, total_floors: building.total_floors,
        total_units: building.total_units, description: building.description || "",
        amenities: building.amenities || [], is_public: building.is_public, status: building.status,
      });
    } else {
      setForm({
        name: "", developer_name: "", address_street: "", address_number: "",
        address_neighborhood: "", address_city: "", address_state: "", address_zip: "",
        year_built: null, total_floors: null, total_units: null, description: "",
        amenities: [], is_public: false, status: "active",
      });
    }
  }, [building, open]);

  const toggleAmenity = (a: string) => {
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities?.includes(a)
        ? prev.amenities.filter(x => x !== a)
        : [...(prev.amenities || []), a],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{building ? "Editar Edifício" : "Novo Edifício"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome do Edifício *</Label>
              <Input value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Construtora</Label>
              <Input value={form.developer_name || ""} onChange={e => setForm(p => ({ ...p, developer_name: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Ano de Construção</Label>
              <Input type="number" value={form.year_built ?? ""} onChange={e => setForm(p => ({ ...p, year_built: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Total de Andares</Label>
              <Input type="number" value={form.total_floors ?? ""} onChange={e => setForm(p => ({ ...p, total_floors: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Total de Unidades</Label>
              <Input type="number" value={form.total_units ?? ""} onChange={e => setForm(p => ({ ...p, total_units: e.target.value ? Number(e.target.value) : null }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Rua</Label>
              <Input value={form.address_street || ""} onChange={e => setForm(p => ({ ...p, address_street: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Número</Label>
              <Input value={form.address_number || ""} onChange={e => setForm(p => ({ ...p, address_number: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={form.address_neighborhood || ""} onChange={e => setForm(p => ({ ...p, address_neighborhood: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.address_city || ""} onChange={e => setForm(p => ({ ...p, address_city: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Input value={form.address_state || ""} onChange={e => setForm(p => ({ ...p, address_state: e.target.value }))} maxLength={2} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.description || ""} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Amenidades</Label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAmenity(a)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                    form.amenities?.includes(a)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:bg-accent"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.is_public || false} onCheckedChange={v => setForm(p => ({ ...p, is_public: v }))} />
            <Label>Visível publicamente no marketplace</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading || !form.name}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {building ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
