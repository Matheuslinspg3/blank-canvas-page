import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface FollowUpQueueItem {
  id: string;
  lead_phone: string;
  lead_name: string | null;
  property_interest: string | null;
  status: string;
  attempt_count: number;
  next_followup_at: string | null;
  last_outbound_at: string | null;
  last_inbound_at: string | null;
  opted_out: boolean;
  created_at: string;
}

export interface FollowUpLogEntry {
  id: string;
  queue_id: string;
  lead_phone: string;
  attempt_number: number;
  message_sent: string;
  message_source: string;
  sent_at: string;
  delivery_status: string | null;
}

export function useBrokerFollowUpQueue() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const queue = useQuery({
    queryKey: ["broker-followup-queue", user?.id],
    queryFn: async () => {
      // First get the broker channel
      const { data: ch } = await supabase
        .from("broker_whatsapp_channels" as any)
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!ch) return [];

      const { data, error } = await supabase
        .from("follow_up_queue" as any)
        .select("id, lead_phone, lead_name, property_interest, status, attempt_count, next_followup_at, last_outbound_at, last_inbound_at, opted_out, created_at")
        .eq("broker_channel_id", (ch as any).id)
        .eq("channel_type", "broker")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data ?? []) as unknown as FollowUpQueueItem[];
    },
    enabled: !!user?.id,
  });

  const logs = useQuery({
    queryKey: ["broker-followup-logs", user?.id],
    queryFn: async () => {
      const { data: ch } = await supabase
        .from("broker_whatsapp_channels" as any)
        .select("id, organization_id")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (!ch) return [];

      const { data, error } = await supabase
        .from("follow_up_log" as any)
        .select("id, queue_id, lead_phone, attempt_number, message_sent, message_source, sent_at, delivery_status")
        .eq("org_id", (ch as any).organization_id)
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data ?? []) as unknown as FollowUpLogEntry[];
    },
    enabled: !!user?.id,
  });

  const optOutMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const { error } = await supabase
        .from("follow_up_queue" as any)
        .update({ opted_out: true, status: "opted_out" } as any)
        .eq("id", queueId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broker-followup-queue"] });
      toast.success("Lead marcado como opt-out");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar"),
  });

  const reactivateMutation = useMutation({
    mutationFn: async (queueId: string) => {
      const { error } = await supabase
        .from("follow_up_queue" as any)
        .update({
          opted_out: false,
          status: "pending",
          next_followup_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        } as any)
        .eq("id", queueId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broker-followup-queue"] });
      toast.success("Lead reativado na fila de follow-up");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao reativar"),
  });

  return {
    queue: queue.data ?? [],
    logs: logs.data ?? [],
    isLoading: queue.isLoading || logs.isLoading,
    optOut: optOutMutation.mutateAsync,
    reactivate: reactivateMutation.mutateAsync,
  };
}
