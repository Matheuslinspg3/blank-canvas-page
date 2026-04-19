import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignConversationOwner, getActiveOwner } from "@/services/omnichannel/assignmentsService";
import { toast } from "sonner";

export function useActiveOwner(conversationId: string | null) {
  return useQuery({
    queryKey: ["omnichannel", "active-owner", conversationId],
    queryFn: () => getActiveOwner(conversationId!),
    enabled: !!conversationId,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

export function useConversationAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, assigneeId }: { conversationId: string; assigneeId: string }) =>
      assignConversationOwner(conversationId, assigneeId),
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["omnichannel", "active-owner", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["omnichannel", "conversation", vars.conversationId] });
      qc.invalidateQueries({ queryKey: ["omnichannel", "conversations"] });
      toast.success("Conversa atribuída.");
    },
    onError: (err: any) => {
      const code = err?.message ?? "";
      const msg =
        code.includes("actor_not_authorized") ? "Você não tem permissão para atribuir conversas." :
        code.includes("assignee_not_eligible") ? "Usuário selecionado não pode receber conversas." :
        code.includes("assignee_org_mismatch") ? "Usuário não pertence a esta organização." :
        code.includes("conversation_not_found") ? "Conversa não encontrada." :
        "Falha ao atribuir conversa.";
      toast.error(msg);
    },
  });
}
