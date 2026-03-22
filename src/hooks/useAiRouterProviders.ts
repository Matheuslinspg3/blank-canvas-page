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
  has_api_key?: boolean;
}

export function useAiRouterProviders() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ai-router-providers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ai_router_providers_safe")
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
    mutationFn: async (provider: Omit<AiRouterProvider, "id" | "created_at" | "last_error_at" | "consecutive_errors" | "has_api_key">) => {
      const { error } = await supabase.from("ai_router_providers").insert(provider as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-router-providers"] });
      toast.success("Provider criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateApiKey = useMutation({
    mutationFn: async ({ id, api_key }: { id: string; api_key: string }) => {
      const { error } = await supabase
        .from("ai_router_providers")
        .update({ api_key } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-router-providers"] });
      toast.success("API Key salva");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateProvider = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from("ai_router_providers")
        .update(fields as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-router-providers"] });
      toast.success("Provider atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProvider = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ai_router_providers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-router-providers"] });
      toast.success("Provider removido");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const testProvider = useMutation({
    mutationFn: async (providerKey: string) => {
      // Find the provider to determine if it's an image model
      const provider = query.data?.find(p => p.provider_key === providerKey);
      const isImageProvider = provider?.supports_image_output && !provider?.supports_image_input;
      
      const startMs = Date.now();
      const { data, error } = await supabase.functions.invoke("ai-router", {
        body: {
          task_type: isImageProvider ? "ad_image" : "summarize",
          prompt: isImageProvider
            ? "A beautiful modern house with a garden, professional real estate photography"
            : "Responda apenas: OK",
          force_provider: providerKey,
        },
      });
      const latency = Date.now() - startMs;
      if (error) throw error;
      if (!data?.success) {
        const errMsg = data?.error || "Falha no teste";
        if (errMsg.includes("429") || errMsg.includes("quota")) {
          throw new Error(`Quota excedida para este provider. A chave API atingiu o limite de uso. Verifique o plano/billing do provedor.`);
        }
        throw new Error(errMsg);
      }
      return { latency, provider: data.provider, model: data.model };
    },
  });

  return {
    providers: query.data || [],
    isLoading: query.isLoading,
    toggleActive,
    resetErrors,
    createProvider,
    updateApiKey,
    updateProvider,
    testProvider,
    deleteProvider,
  };
}
