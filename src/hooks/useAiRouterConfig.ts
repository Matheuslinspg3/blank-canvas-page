import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AiRouterTask {
  id: string;
  task_type: string;
  display_name: string;
  description: string | null;
  complexity: string;
  provider_chain: string[];
  system_prompt: string | null;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
  requires_image: boolean;
  created_at: string;
  updated_at: string;
}

export function useAiRouterConfig() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ai-router-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_router_config")
        .select("id, task_type, display_name, description, complexity, provider_chain, system_prompt, max_tokens, temperature, is_active, requires_image, created_at, updated_at")
        .order("task_type");
      if (error) throw error;
      return (data || []) as AiRouterTask[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const updateTask = useMutation({
    mutationFn: async (task: Partial<AiRouterTask> & { id: string }) => {
      const { id, ...updates } = task;
      const { error } = await supabase
        .from("ai_router_config")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-router-config"] });
      toast.success("Task atualizada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createTask = useMutation({
    mutationFn: async (task: Omit<AiRouterTask, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("ai_router_config").insert(task as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-router-config"] });
      toast.success("Task criada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("ai_router_config")
        .update({ is_active, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai-router-config"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return { tasks: query.data || [], isLoading: query.isLoading, updateTask, createTask, toggleActive };
}
