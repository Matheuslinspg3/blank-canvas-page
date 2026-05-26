import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as Sentry from "@sentry/react";
import { normalizeQrCode, type WhatsAppStatus, type WhatsAppConnection, type WhatsAppError } from "@/hooks/useWhatsAppV2";

/**
 * Hook dedicado ao canal individual "Meu WhatsApp" (source = 1).
 * Usa a edge function `whatsapp-broker-instance` (Evolution direto).
 * Não compartilha estado com o agente IA de automações (source = 2),
 * que continua usando `useWhatsAppV2` → `whatsapp-n8n-controller`.
 */
export function useBrokerWhatsApp() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-broker-instance", {
      body: {
        action,
        source: 1,
        source_label: "broker_personal_whatsapp",
        requested_by_user_id: user?.id ?? null,
        ...extra,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const { data: statusData, isLoading, error, refetch } = useQuery({
    queryKey: ["broker-whatsapp-status", user?.id],
    queryFn: async () => {
      try {
        return await invoke("status");
      } catch (err) {
        Sentry.captureException(err, { tags: { function: "whatsapp-broker-instance", action: "status" } });
        throw err;
      }
    },
    enabled: !!user,
    retry: 1,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (s === "connecting" || s === "qr_pending" || s === "pairing_pending") return 5000;
      return 15000;
    },
    refetchIntervalInBackground: false,
  });

  const connectMutation = useMutation({
    mutationFn: async ({ phoneNumber }: { mode?: "qr" | "pairing"; phoneNumber?: string }) => {
      return invoke("connect", { phoneNumber: phoneNumber?.replace(/\D/g, "") });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["broker-whatsapp-status", user?.id] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao conectar Meu WhatsApp");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => invoke("delete"),
    onSuccess: () => {
      queryClient.setQueryData(["broker-whatsapp-status", user?.id], { status: "disconnected", phone: null, qr_code: null });
      toast.success("Meu WhatsApp desconectado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao remover conexão");
    },
  });

  const status = ((statusData?.status as WhatsAppStatus) || "not_configured") as WhatsAppStatus;

  const connection = useMemo<WhatsAppConnection | undefined>(() => {
    if (!statusData) return undefined;
    return {
      id: "broker",
      status,
      instance_name: "broker",
      phone_number: statusData.phone || null,
      qr_code: normalizeQrCode(statusData.qr_code),
      pairing_code: statusData.pairing_code || null,
      provider: "evolution_broker",
    };
  }, [statusData, status]);

  // Map "disconnected" with no instance to "not_configured" for UI parity with V2
  const uiStatus: WhatsAppStatus =
    status === "disconnected" && !statusData?.phone && !statusData?.qr_code ? "not_configured" : status;

  return {
    connection,
    status: uiStatus,
    isLoading: isLoading && !statusData,
    error: (error || connectMutation.error) as WhatsAppError | null,
    connect: connectMutation.mutate,
    isConnecting: connectMutation.isPending,
    connectError: connectMutation.error as WhatsAppError | null,
    resetConnect: connectMutation.reset,
    deleteConnection: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    refetch,
  };
}
