import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BrokerFollowUp {
  id: string;
  lead_phone: string;
  lead_name: string | null;
  status: string;
  opted_out: boolean;
  created_at: string;
}

export function useLeadFollowUpStatus(leadId?: string, leadPhone?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["lead-followup-status", leadId, leadPhone],
    queryFn: async () => {
      if (!user?.id || !leadPhone) return null;

      // Get channel
      const { data: ch } = await supabase
        .from("broker_whatsapp_channels" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!ch) return null;

      const { data, error } = await supabase
        .from("follow_up_queue" as any)
        .select("id, lead_phone, lead_name, status, opted_out, created_at")
        .eq("broker_channel_id", (ch as any).id)
        .eq("lead_phone", leadPhone)
        .eq("channel_type", "broker")
        .maybeSingle();

      if (error) throw error;
      return data as BrokerFollowUp | null;
    },
    enabled: !!user?.id && !!leadPhone,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ action, leadName }: { action: 'start' | 'stop', leadName?: string }) => {
      if (!user?.id || !leadPhone) return;

      const { data: ch } = await supabase
        .from("broker_whatsapp_channels" as any)
        .select("id, organization_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!ch) throw new Error("Canal WhatsApp não encontrado");

      if (action === 'start') {
        const { error } = await supabase
          .from("follow_up_queue" as any)
          .upsert({
            broker_channel_id: (ch as any).id,
            org_id: (ch as any).organization_id,
            channel_type: 'broker',
            lead_phone: leadPhone,
            lead_name: leadName || null,
            status: 'pending',
            next_followup_at: new Date().toISOString(),
            opted_out: false
          } as any, { onConflict: 'broker_channel_id,lead_phone,channel_type' } as any);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follow_up_queue" as any)
          .update({ opted_out: true, status: 'opted_out' } as any)
          .eq("broker_channel_id", (ch as any).id)
          .eq("lead_phone", leadPhone)
          .eq("channel_type", 'broker');
        
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["lead-followup-status"] });
      qc.invalidateQueries({ queryKey: ["broker-followup-queue"] });
      toast.success(variables.action === 'start' ? "Follow-up ativado" : "Follow-up desativado");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao atualizar follow-up"),
  });

  return {
    followUp: query.data,
    isLoading: query.isLoading,
    toggle: toggleMutation.mutateAsync,
    isPending: toggleMutation.isPending
  };
}
