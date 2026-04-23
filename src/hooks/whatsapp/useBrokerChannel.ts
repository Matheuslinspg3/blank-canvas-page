import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BrokerChannel {
  id: string;
  organization_id: string;
  user_id: string;
  instance_name: string | null;
  phone_number: string | null;
  status: string;
  qr_code: string | null;
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

const QK = "broker-whatsapp-channel";

export function useBrokerChannel() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [QK, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-broker-instance", {
        body: { action: "status" },
      });
      if (error) throw error;
      return data as { status: string; phone: string | null; qr_code: string | null };
    },
    enabled: !!user?.id && !!profile?.organization_id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "connecting") return 5000;
      return 30000;
    },
    staleTime: 10_000,
  });

  const connectMutation = useMutation({
    mutationFn: async (params?: { phoneNumber?: string } | void) => {
      const phoneNumber = (params as any)?.phoneNumber;
      const { data, error } = await supabase.functions.invoke("whatsapp-broker-instance", {
        body: { action: "connect", phoneNumber },
      });
      if (error) throw error;
      return data as { status: string; qr_code: string | null; pairing_code: string | null };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [QK] });
      if (data?.pairing_code) toast.success(`Código gerado: ${data.pairing_code}`);
      else toast.success("Conectando WhatsApp...");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao conectar"),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (targetUserId?: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-broker-instance", {
        body: { action: "disconnect", targetUserId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("WhatsApp desconectado");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao desconectar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (targetUserId?: string) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-broker-instance", {
        body: { action: "delete", targetUserId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Instância removida");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao remover"),
  });

  return {
    status: query.data?.status ?? "disconnected",
    phone: query.data?.phone ?? null,
    qrCode: query.data?.qr_code ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
    connect: connectMutation.mutate,
    connectAsync: connectMutation.mutateAsync,
    pairingCode: connectMutation.data?.pairing_code ?? null,
    disconnect: disconnectMutation.mutate,
    deleteInstance: deleteMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
  };
}

export function useTeamChannels() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["broker-whatsapp-team-channels", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broker_whatsapp_channels" as any)
        .select("*, profiles!broker_whatsapp_channels_user_id_fkey(full_name, avatar_url)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!orgId,
    staleTime: 30_000,
  });
}
