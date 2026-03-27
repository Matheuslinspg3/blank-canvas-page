import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";

const safeText = (value: unknown) => String(value ?? "").trim();

const throwDetailedFunctionError = async (error: any): Promise<never> => {
  const fallback = safeText(error?.message) || "Erro na função de WhatsApp";

  try {
    const response = error?.context;
    if (!response?.clone) throw new Error("no response context");

    try {
      const json = await response.clone().json();
      const detailed = safeText(json?.error || json?.message || JSON.stringify(json));
      throw new Error(detailed || fallback);
    } catch {
      const text = await response.clone().text();
      throw new Error(safeText(text) || fallback);
    }
  } catch {
    throw new Error(fallback);
  }
};

export function useWhatsAppInstance() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: instance, isLoading } = useQuery({
    queryKey: ["whatsapp-instance", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("whatsapp_instances" as any)
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!orgId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });

  const statusMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "status" },
      });
      if (error) await throwDetailedFunctionError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      if (data?.status === "connected") {
        toast.success("WhatsApp conectado!");
      } else {
        toast.info(`Status: ${data?.status || "desconhecido"}`);
      }
      invalidate();
    },
    onError: (err: Error) => {
      toastError("Erro ao verificar status WhatsApp", err, { module: "useWhatsAppInstance" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "disconnect" },
      });
      if (error) await throwDetailedFunctionError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("WhatsApp desconectado");
      invalidate();
    },
    onError: (err: Error) => {
      toastError("Erro ao desconectar WhatsApp", err, { module: "useWhatsAppInstance" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "delete" },
      });
      if (error) await throwDetailedFunctionError(error);
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Instância WhatsApp removida");
      invalidate();
    },
    onError: (err: Error) => {
      toastError("Erro ao remover instância WhatsApp", err, { module: "useWhatsAppInstance" });
    },
  });

  return {
    instance,
    isLoading,
    checkStatus: () => statusMutation.mutateAsync(),
    disconnectInstance: () => disconnectMutation.mutateAsync(),
    deleteInstance: () => deleteMutation.mutateAsync(),
    isCheckingStatus: statusMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
