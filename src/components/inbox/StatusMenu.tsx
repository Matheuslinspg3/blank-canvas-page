import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tag, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateConversationStatus } from "@/services/omnichannel/conversationsService";
import type { Conversation, ConversationStatus } from "@/types/omnichannel";
import { toast } from "sonner";

interface Props {
  conversation: Conversation;
}

const STATUS_OPTIONS: { value: ConversationStatus; label: string }[] = [
  { value: "open", label: "Aberta" },
  { value: "pending", label: "Pendente" },
  { value: "assigned", label: "Atribuída" },
  { value: "snoozed", label: "Adiada" },
  { value: "closed", label: "Fechada" },
];

export function StatusMenu({ conversation }: Props) {
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (status: ConversationStatus) => updateConversationStatus(conversation.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["omnichannel", "conversation", conversation.id] });
      qc.invalidateQueries({ queryKey: ["omnichannel", "conversations"] });
      toast.success("Status atualizado.");
    },
    onError: () => toast.error("Falha ao atualizar status."),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5">
          {mut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
          <span className="text-xs">Status</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs">Mudar para</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {STATUS_OPTIONS.map((o) => (
          <DropdownMenuItem
            key={o.value}
            disabled={o.value === conversation.status || mut.isPending}
            onClick={() => mut.mutate(o.value)}
            className="text-xs"
          >
            {o.label}
            {o.value === conversation.status && (
              <span className="ml-auto text-[10px] text-muted-foreground">atual</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
