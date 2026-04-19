import { useQuery } from "@tanstack/react-query";
import { getConversation } from "@/services/omnichannel/conversationsService";

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ["omnichannel", "conversation", conversationId],
    queryFn: () => getConversation(conversationId!),
    enabled: !!conversationId,
    refetchInterval: 12_000,
    staleTime: 5_000,
  });
}
