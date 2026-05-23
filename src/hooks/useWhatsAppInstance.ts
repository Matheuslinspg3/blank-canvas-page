import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

export interface WhatsAppError {
  ok: false;
  code: string;
  message: string;
  debug_ref?: string;
  status?: number;
}

interface SupabaseFunctionError {
  message: string;
  context?: {
    status?: number;
    clone?: () => {
      json: () => Promise<any>;
    };
  };
}

const handleFunctionError = async (error: SupabaseFunctionError, functionName: string, action: string, orgId?: string) => {
  const status = error?.context?.status;
  let payload: any = null;
  
  try {
    const response = error?.context;
    if (response?.clone) {
      payload = await response.clone().json();
    }
  } catch { /* ignore */ }

  const code = payload?.code || "FETCH_ERROR";
  const message = payload?.message || error?.message || "Erro de comunicação";
  const debug_ref = payload?.debug_ref;

  Sentry.captureException(error, {
    tags: {
      function_name: functionName,
      action,
      error_code: code,
      http_status: status,
    },
    extra: {
      debug_ref,
      org_id: orgId,
      payload,
    }
  });

  return { ok: false, code, message, debug_ref, status } as WhatsAppError;
};

export interface WhatsAppConfig {
  id: string;
  organization_id: string;
  instance_name?: string;
  instance_token?: string;
  status: "connected" | "connecting" | "provisioning" | "disconnected";
  phone_number?: string;
  qr_code?: string;
  webhook_url?: string;
}

export function useWhatsAppInstance() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: instance, isLoading } = useQuery({
    queryKey: ["whatsapp-instance", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("whatsapp_agent_config" as any)
        .select("id, organization_id, instance_name, instance_token, status, phone_number, qr_code, webhook_url")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data as WhatsAppConfig;
    },
    enabled: !!orgId,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["whatsapp-instance"] });

  const statusMutation = useMutation({
    mutationKey: ["whatsapp-instance-status", orgId],
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "status" },
      });
      if (error) throw await handleFunctionError(error as SupabaseFunctionError, "whatsapp-instance", "status", orgId);
      if (data?.ok === false) throw data;
      return data;
    },
    onSuccess: (data) => {
      if (data?.status === "connected") {
        toast.success("WhatsApp conectado!");
      }
      invalidate();
    },
    onError: (err: any) => {
      if (err.ok === false) {
        toast.error(err.message, { description: err.debug_ref });
      }
    },
  });

  const disconnectMutation = useMutation({
    mutationKey: ["whatsapp-instance-disconnect", orgId],
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "disconnect" },
      });
      if (error) throw await handleFunctionError(error as SupabaseFunctionError, "whatsapp-instance", "disconnect", orgId);
      if (data?.ok === false) throw data;
      return data;
    },
    onSuccess: () => {
      toast.success("WhatsApp desconectado");
      invalidate();
    },
    onError: (err: any) => {
      if (err.ok === false) {
        toast.error("Erro ao desconectar", { description: err.message });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationKey: ["whatsapp-instance-delete", orgId],
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "delete" },
      });
      if (error) throw await handleFunctionError(error as SupabaseFunctionError, "whatsapp-instance", "delete", orgId);
      if (data?.ok === false) throw data;
      return data;
    },
    onSuccess: () => {
      toast.success("Integração WhatsApp removida");
      invalidate();
    },
    onError: (err: any) => {
       if (err.ok === false) {
        toast.error("Erro ao remover", { description: err.message });
      }
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
