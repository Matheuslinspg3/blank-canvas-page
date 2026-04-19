import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  listConversations,
  type ListConversationsParams,
} from "@/services/omnichannel/conversationsService";

export function useConversations(
  params: Omit<ListConversationsParams, "organizationId"> = {}
) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["omnichannel", "conversations", orgId, params],
    queryFn: () => listConversations({ ...params, organizationId: orgId! }),
    enabled: !!orgId,
    refetchInterval: 15_000,
  });
}
