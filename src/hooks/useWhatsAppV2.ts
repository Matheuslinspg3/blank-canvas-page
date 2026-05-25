import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";

export type WhatsAppStatus = 
  | "not_configured" 
  | "provisioning" 
  | "qr_pending" 
  | "pairing_pending" 
  | "connecting" 
  | "connected" 
  | "disconnected" 
  | "error" 
  | "deleting"
  | "unknown";

export interface WhatsAppConnection {
  id: string;
  status: WhatsAppStatus;
  instance_name: string;
  phone_number: string | null;
  qr_code: string | null;
  pairing_code: string | null;
  provider: string;
}

export interface WhatsAppError extends Error {
  code?: string;
  debug_ref?: string;
}

export function useWhatsAppV2() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: connectionData, isLoading, error, refetch } = useQuery({
    queryKey: ["whatsapp-connection-v2"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-n8n-controller", {
          body: { action: "status" }
        });
        if (error) throw error;
        return data as { 
          ok: boolean; 
          status: WhatsAppStatus; 
          connected: boolean;
          phoneNumber: string;
          qrCode?: string;
          pairingCode?: string;
          connection?: WhatsAppConnection;
        };
      } catch (err: any) {
        console.error("Error fetching whatsapp status:", err);
        Sentry.captureException(err, { tags: { function: "whatsapp-n8n-controller", action: "status" } });
        return { ok: false, status: "unknown" as WhatsAppStatus, connected: false, phoneNumber: "" };
      }
    },
    enabled: !!user,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "qr_pending" || status === "pairing_pending" || status === "provisioning" || status === "connecting") {
        return 5000;
      }
      return false;
    }
  });

  const connectMutation = useMutation({
    mutationFn: async ({ mode, phoneNumber }: { mode: "qr" | "pairing", phoneNumber?: string }) => {
      const action = connectionData?.status === "disconnected" || connectionData?.status === "error" ? "reconnect" : "create";
      
      const { data, error } = await supabase.functions.invoke("whatsapp-n8n-controller", {
        body: { 
          action,
          mode,
          phoneNumber: phoneNumber?.replace(/\D/g, '')
        }
      });

      if (error) throw error;
      if (!data.ok) throw new Error(data.message || "Erro ao conectar");
      
      return data;
    },
    onSuccess: (result) => {
      if (result.ok && result.message) {
        toast.success(result.message);
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection-v2"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao iniciar conexão via Webhook");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-n8n-controller", {
        body: { action: "disconnect" }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData(["whatsapp-connection-v2"], { ok: true, status: "not_configured" });
      toast.success("Integração removida localmente");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao remover integração");
    }
  });

  return {
    connection: connectionData?.connection || (connectionData ? {
      id: "n8n",
      status: (connectionData as any).status || "unknown",
      instance_name: "n8n",
      phone_number: (connectionData as any).phoneNumber || null,
      qr_code: (connectionData as any).qrCode || null,
      pairing_code: (connectionData as any).pairingCode || null,
      provider: "n8n_evolution_go"
    } : undefined),
    status: (connectionData?.status as WhatsAppStatus) || "not_configured",
    isLoading: isLoading && !connectionData,
    error: (error || connectMutation.error) as WhatsAppError | null,
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
    connectError: connectMutation.error as WhatsAppError | null,
    resetConnect: connectMutation.reset,
    deleteConnection: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    refetch
  };
}
