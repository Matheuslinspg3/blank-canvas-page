import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sendWhatsAppWebhook, buildWhatsAppPayload } from "@/services/whatsapp/webhookService";

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
      const { data: organization } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", profile?.organization_id)
        .maybeSingle();

      const payload = buildWhatsAppPayload(
        connectionData?.status === "disconnected" || connectionData?.status === "error" ? "reconnect" : "create",
        "broker_whatsapp",
        { user, profile, organization, brokerId: profile?.id }
      );

      const result = await sendWhatsAppWebhook(payload);
      
      if (!result.ok) {
        throw new Error(result.error);
      }
      
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.message) {
        toast.success(data.message);
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection-v2"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao iniciar conexão via Webhook");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { data: organization } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("id", profile?.organization_id)
        .maybeSingle();

      const payload = buildWhatsAppPayload(
        "disconnect",
        "broker_whatsapp",
        { user, profile, organization, brokerId: profile?.id }
      );

      const result = await sendWhatsAppWebhook(payload);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["whatsapp-connection-v2"], { ok: true, status: "not_configured" });
      toast.success(data?.message || "Solicitação de remoção enviada");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao remover integração");
    }
  });

  return {
    connection: connectionData?.connection,
    status: connectionData?.status || "not_configured",
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
