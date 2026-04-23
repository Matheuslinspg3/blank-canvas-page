import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BrokerAutomationConfig {
  greeting_enabled: boolean;
  greeting_template_id: string | null;
  followup_enabled: boolean;
  followup_intervals: number[];
  followup_max_attempts: number;
  followup_business_hours: { start: string; end: string };
}

const QK = "broker-automation-config";

export function useBrokerAutomation() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: [QK, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broker_whatsapp_channels" as any)
        .select("id, greeting_enabled, greeting_template_id, followup_enabled, followup_intervals, followup_max_attempts, followup_business_hours")
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        channelId: (data as any).id as string,
        config: {
          greeting_enabled: (data as any).greeting_enabled ?? false,
          greeting_template_id: (data as any).greeting_template_id ?? null,
          followup_enabled: (data as any).followup_enabled ?? false,
          followup_intervals: (data as any).followup_intervals ?? [24, 48, 72],
          followup_max_attempts: (data as any).followup_max_attempts ?? 3,
          followup_business_hours: (data as any).followup_business_hours ?? { start: "08:00", end: "18:00" },
        } as BrokerAutomationConfig,
      };
    },
    enabled: !!user?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<BrokerAutomationConfig>) => {
      const channelId = query.data?.channelId;
      if (!channelId) throw new Error("Canal não encontrado. Conecte seu WhatsApp primeiro.");

      const { error } = await supabase
        .from("broker_whatsapp_channels" as any)
        .update(updates as any)
        .eq("id", channelId);

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      toast.success("Configuração salva");
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao salvar"),
  });

  return {
    channelId: query.data?.channelId ?? null,
    config: query.data?.config ?? null,
    isLoading: query.isLoading,
    update: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
  };
}
