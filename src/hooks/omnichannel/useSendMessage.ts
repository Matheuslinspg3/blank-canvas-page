import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendConversationMessage, type SendPayload } from "@/services/omnichannel/messagingService";
import type { Conversation } from "@/types/omnichannel";
import { toast } from "sonner";

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversation, payload }: { conversation: Conversation; payload: SendPayload }) =>
      sendConversationMessage(conversation, payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["omnichannel", "messages", vars.conversation.id] });
      qc.invalidateQueries({ queryKey: ["omnichannel", "conversations"] });
    },
    onError: (err: any) => {
      const msg = err?.message ?? "Falha ao enviar mensagem";
      toast.error(msg);
    },
  });
}
