import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export type WhatsAppStatus = 
  | "not_configured" 
  | "provisioning" 
  | "qr_pending" 
  | "pairing_pending" 
  | "connecting" 
  | "connected" 
  | "disconnected" 
  | "error" 
  | "deleting";

export interface WhatsAppConnection {
  id: string;
  status: WhatsAppStatus;
  instance_name: string;
  phone_number: string | null;
  qr_code: string | null;
  pairing_code: string | null;
  provider: string;
}

export function useWhatsAppV2() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: connectionData, isLoading, error, refetch } = useQuery({
    queryKey: ["whatsapp-connection-v2"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-status");
      if (error) throw error;
      return data as { ok: boolean; status: WhatsAppStatus; connection?: WhatsAppConnection };
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
      console.log(`[WhatsAppV2] Connecting mode=${mode} phone=${phoneNumber}`);
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { mode, phone_number: phoneNumber }
      });
      
      if (error) {
        console.error("[WhatsAppV2] Invocation error:", error);
        throw error;
      }
      
      if (!data.ok) {
        console.error("[WhatsAppV2] Function returned error:", data);
        const error = new Error(data.message || "Erro ao conectar") as any;
        error.code = data.code;
        error.debug_ref = data.debug_ref;
        throw error;
      }
      
      return data;
    },
    onSuccess: (data) => {
      // Update cache immediately for better UX
      queryClient.setQueryData(["whatsapp-connection-v2"], {
        ok: true,
        status: data.status,
        connection: data.connection
      });
      // Still invalidate to ensure we have the absolute latest from status check
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection-v2"] });
    },
    onError: (err: any) => {
      const msg = err.debug_ref ? `${err.message} (${err.debug_ref})` : err.message;
      toast.error(msg || "Falha ao iniciar conexão");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-delete");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.setQueryData(["whatsapp-connection-v2"], { ok: true, status: "not_configured" });
      toast.success("Integração removida com sucesso");
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao remover integração");
    }
  });

  return {
    connection: connectionData?.connection,
    status: connectionData?.status || "not_configured",
    isLoading,
    error: error || connectMutation.error,
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
    connectError: connectMutation.error as any,
    deleteConnection: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    refetch
  };
}
