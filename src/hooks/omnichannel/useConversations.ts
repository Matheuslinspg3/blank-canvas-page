import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  listConversations,
  type ListConversationsParams,
} from "@/services/omnichannel/conversationsService";

export function useConversations(
  params: Omit<ListConversationsParams, "organizationId"> = {},
  opts: { realtimeConnected?: boolean } = {},
) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["omnichannel", "conversations", orgId, params],
    queryFn: () => listConversations({ ...params, organizationId: orgId! }),
    enabled: !!orgId,
    // Polling como fallback: intervalo curto sem realtime, longo com realtime.
    refetchInterval: opts.realtimeConnected ? 45_000 : 15_000,
  });
}
