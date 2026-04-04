import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface Building {
  id: string;
  organization_id: string;
  name: string;
  developer_name: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  latitude: number | null;
  longitude: number | null;
  year_built: number | null;
  total_floors: number | null;
  total_units: number | null;
  description: string | null;
  amenities: string[];
  images: string[];
  status: string;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type BuildingFormData = Omit<Building, "id" | "organization_id" | "created_by" | "created_at" | "updated_at">;

export function useBuildings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: buildings = [], isLoading } = useQuery({
    queryKey: ["buildings", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buildings" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Building[];
    },
    enabled: !!orgId,
  });

  const createBuilding = useMutation({
    mutationFn: async (form: Partial<BuildingFormData>) => {
      const { data, error } = await supabase
        .from("buildings" as any)
        .insert({ ...form, organization_id: orgId } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Building;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buildings"] });
      toast({ title: "Edifício cadastrado com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro ao cadastrar", description: e.message, variant: "destructive" }),
  });

  const updateBuilding = useMutation({
    mutationFn: async ({ id, ...form }: Partial<BuildingFormData> & { id: string }) => {
      const { data, error } = await supabase
        .from("buildings" as any)
        .update(form as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as Building;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buildings"] });
      toast({ title: "Edifício atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }),
  });

  const deleteBuilding = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("buildings" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buildings"] });
      toast({ title: "Edifício removido" });
    },
    onError: (e: any) => toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  return {
    buildings,
    isLoading,
    createBuilding,
    updateBuilding,
    deleteBuilding,
  };
}
