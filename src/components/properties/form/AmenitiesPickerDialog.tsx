import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Tags, Loader2 } from "lucide-react";
import { usePropertyAmenities, useCreateAmenity } from "@/hooks/usePropertyAmenities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface AmenitiesPickerDialogProps {
  selected: string[];
  onChange: (amenities: string[]) => void;
}

const CATEGORIES = [
  "Lazer", "Vista e Localização", "Infraestrutura", "Mobília",
  "Conveniência", "Tipo de Construção", "Zona Fiscal", "Banheiros", "Geral",
];

export function AmenitiesPickerDialog({ selected, onChange }: AmenitiesPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Geral");
  const [showCreate, setShowCreate] = useState(false);

  const { data: amenities = [], isLoading } = usePropertyAmenities();
  const createAmenity = useCreateAmenity();

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
    const groups: Record<string, typeof amenities> = {};
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
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((amenity) => (
                      <label
                        key={amenity.id}
                        className="flex items-center gap-2 text-sm cursor-pointer p-1.5 rounded-md hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          checked={selected.includes(amenity.name)}
                          onCheckedChange={() => toggleAmenity(amenity.name)}
                        />
                        <span>{amenity.name}</span>
                      </label>
                    ))}
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
    </Dialog>
  );
}
