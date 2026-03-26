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
}

export function usePropertyAmenities() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["property-amenities", orgId],
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from("property_amenities")
        .select("id, name, category, is_default")
        .eq("organization_id", orgId)
        .order("category")
        .order("name");

      if (error) throw error;
      return (data || []) as PropertyAmenity[];
    },
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
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
        .select("id, name, category, is_default")
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("Essa característica já existe");
        throw error;
      }
      return data as PropertyAmenity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-amenities"] });
      toast.success("Característica criada!");
    },
    onError: (err: Error) => {
      toastError("Erro ao criar característica", err, { module: "usePropertyAmenities" });
    },
  });
}
