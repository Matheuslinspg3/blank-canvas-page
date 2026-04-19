import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { useSendMessage } from "@/hooks/omnichannel/useSendMessage";
import type { Conversation } from "@/types/omnichannel";

interface Props {
  conversation: Conversation;
}

export function ConversationComposer({ conversation }: Props) {
  const [text, setText] = useState("");
  const send = useSendMessage();

  const disabled = !text.trim() || send.isPending || conversation.status === "closed";

  const handleSend = () => {
    if (disabled) return;
    send.mutate(
      { conversation, payload: { text: text.trim() } },
      { onSuccess: () => setText("") },
    );
  };

  return (
    <div className="border-t p-3">
      {conversation.status === "closed" ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          Conversa fechada. Reabra para enviar mensagens.
        </p>
      ) : (
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mensagem..."
            rows={2}
            className="resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            disabled={disabled}
            onClick={handleSend}
            aria-label="Enviar"
          >
            {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
