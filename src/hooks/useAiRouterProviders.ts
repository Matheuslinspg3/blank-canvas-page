import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AiRouterProvider {
  id: string;
  provider_key: string;
  display_name: string;
  provider_type: string;
  model_id: string;
  env_secret_name: string;
  api_base_url: string;
  is_free: boolean;
  is_active: boolean;
  priority: number;
  supports_image_input: boolean;
  supports_image_output: boolean;
  rate_limit_rpm: number | null;
  rate_limit_rpd: number | null;
  last_error_at: string | null;
  consecutive_errors: number;
  notes: string | null;
  created_at: string;
}

export function useAiRouterProviders() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ai-router-providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_router_providers")
        .select("*")
        .order("provider_type")
        .order("display_name");
      if (error) throw error;
      return (data || []) as AiRouterProvider[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("ai_router_providers")
        .update({ is_active } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-router-providers"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const resetErrors = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_router_providers")
        .update({ consecutive_errors: 0, last_error_at: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-router-providers"] });
      toast.success("Erros resetados");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createProvider = useMutation({
    mutationFn: async (provider: Omit<AiRouterProvider, "id" | "created_at" | "last_error_at" | "consecutive_errors">) => {
      const { error } = await supabase.from("ai_router_providers").insert(provider as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-router-providers"] });
      toast.success("Provider criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { providers: query.data || [], isLoading: query.isLoading, toggleActive, resetErrors, createProvider };
}
