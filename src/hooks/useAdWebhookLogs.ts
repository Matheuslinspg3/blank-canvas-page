import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdWebhookLog {
  id: string;
  organization_id: string;
  provider: string;
  external_lead_id: string | null;
  payload: any;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useAdWebhookLogs() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["ad-webhook-logs", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      const { data, error } = await supabase
        .from("ad_webhook_logs")
        .select("*")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as AdWebhookLog[];
    },
    enabled: !!profile?.organization_id,
    refetchInterval: 10000, // Poll every 10 seconds for "real-time" feel
  });
}
