import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationLead {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  temperature: string | null;
  estimated_value: number | null;
  lead_stage_id: string | null;
}

export function useConversationLead(leadId: string | null) {
  return useQuery({
    queryKey: ["omnichannel", "conversation-lead", leadId],
    queryFn: async (): Promise<ConversationLead | null> => {
      if (!leadId) return null;
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, email, phone, temperature, estimated_value, lead_stage_id")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!leadId,
    staleTime: 30_000,
  });
}
