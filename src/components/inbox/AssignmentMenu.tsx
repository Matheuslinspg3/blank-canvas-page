import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserPlus, Loader2 } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRole";
import { useEligibleAssignees } from "@/hooks/omnichannel/useEligibleAssignees";
import {
  useActiveOwner,
  useConversationAssignment,
} from "@/hooks/omnichannel/useConversationAssignment";
import type { Conversation } from "@/types/omnichannel";

interface Props {
  conversation: Conversation;
}

export function AssignmentMenu({ conversation }: Props) {
  const { isAdmin, isSubAdmin, isLeader, isDeveloper } = useUserRoles();
  const canAssign = isAdmin || isSubAdmin || isLeader || isDeveloper;

  const { data: assignees = [], isLoading } = useEligibleAssignees();
  const { data: activeOwner } = useActiveOwner(conversation.id);
  const assign = useConversationAssignment();

  if (!canAssign) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5">
          <UserPlus className="w-3.5 h-3.5" />
          <span className="text-xs">
            {activeOwner ? "Reatribuir" : "Atribuir"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs">Atribuir a</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : assignees.length === 0 ? (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            Nenhum membro elegível.
          </div>
        ) : (
          assignees.map((a) => (
            <DropdownMenuItem
              key={a.user_id}
              disabled={assign.isPending || a.user_id === activeOwner?.assigned_to}
              onClick={() =>
                assign.mutate({
                  conversationId: conversation.id,
                  assigneeId: a.user_id,
                })
              }
              className="text-xs"
            >
              {a.full_name ?? a.user_id.slice(0, 8)}
              {a.user_id === activeOwner?.assigned_to && (
                <span className="ml-auto text-[10px] text-muted-foreground">atual</span>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
