import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";

export interface PropertyAmenity {
  id: string;
  name: string;
  category: string;
  is_default: boolean;
  created_by: string | null;
  organization_id: string | null;
}

export function usePropertyAmenities() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["property-amenities", orgId],
    queryFn: async () => {
      // RLS allows: organization_id IS NULL (global) OR organization_id = my org
      const { data, error } = await supabase
        .from("property_amenities")
        .select("id, name, category, is_default, created_by, organization_id")
        .order("is_default", { ascending: false })
        .order("category")
        .order("name");

      if (error) throw error;
      return (data || []) as PropertyAmenity[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["property-amenities"] });
  qc.invalidateQueries({ queryKey: ["property-amenities-filter"] });
}

export function useCreateAmenity() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, category }: { name: string; category: string }) => {
      if (!profile?.organization_id) throw new Error("Sem organização");

      const { data, error } = await supabase
        .from("property_amenities")
        .insert({
          organization_id: profile.organization_id,
          name: name.trim(),
          category: category.trim() || "Geral",
          is_default: false,
          created_by: profile.user_id,
        })
        .select("id, name, category, is_default, created_by")
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("Essa característica já existe");
        throw error;
      }
      return data as PropertyAmenity;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Característica criada!");
    },
    onError: (err: Error) => {
      toastError("Erro ao criar característica", err, { module: "usePropertyAmenities" });
    },
  });
}

export function useUpdateAmenity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, category }: { id: string; name: string; category: string }) => {
      const { data, error } = await supabase
        .from("property_amenities")
        .update({ name: name.trim(), category: category.trim() || "Geral" })
        .eq("id", id)
        .select("id, name, category, is_default, created_by")
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("Já existe uma característica com esse nome");
        throw error;
      }
      return data as PropertyAmenity;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      toast.success("Característica atualizada!");
    },
    onError: (err: Error) => {
      toastError("Erro ao atualizar característica", err, { module: "usePropertyAmenities" });
    },
  });
}

export function useDeleteAmenity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name, removeFromProperties }: { id: string; name: string; removeFromProperties: boolean }) => {
      if (removeFromProperties) {
        const { error: rpcErr } = await supabase.rpc("remove_amenity_from_properties", { p_name: name });
        if (rpcErr) throw rpcErr;
      }
      const { error } = await supabase.from("property_amenities").delete().eq("id", id);
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      invalidateAll(queryClient);
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast.success("Característica excluída!");
    },
    onError: (err: Error) => {
      toastError("Erro ao excluir característica", err, { module: "usePropertyAmenities" });
    },
  });
}

export async function countAmenityUsage(name: string): Promise<number> {
  const { data, error } = await supabase.rpc("count_amenity_usage", { p_name: name });
  if (error) throw error;
  return (data as number) ?? 0;
}
