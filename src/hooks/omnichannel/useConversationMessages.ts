import { useQuery } from "@tanstack/react-query";
import { listMessagesByConversation } from "@/services/omnichannel/messagesService";

export function useConversationMessages(conversationId: string | null, limit = 100) {
  return useQuery({
    queryKey: ["omnichannel", "messages", conversationId, limit],
    queryFn: () => listMessagesByConversation({ conversationId: conversationId!, limit }),
    enabled: !!conversationId,
    refetchInterval: 10_000,
  });
}
