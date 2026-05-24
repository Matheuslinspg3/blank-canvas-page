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
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { mode, phone_number: phoneNumber }
      });
      if (error) throw error;
      if (!data.ok) throw new Error(data.message || "Erro ao conectar");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection-v2"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao iniciar conexão");
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
    error,
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
    deleteConnection: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    refetch
  };
}
