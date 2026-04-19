import { useConversation } from "@/hooks/omnichannel/useConversation";
import { useConversationLead } from "@/hooks/omnichannel/useConversationLead";
import { Loader2, UserX, Phone, Mail, Thermometer } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  conversationId: string | null;
}

export function LeadSummaryPanel({ conversationId }: Props) {
  const { data: conversation, isLoading: convLoading } = useConversation(conversationId);
  const { data: lead, isLoading: leadLoading } = useConversationLead(conversation?.lead_id ?? null);

  if (!conversationId) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
        Sem conversa selecionada.
      </div>
    );
  }

  if (convLoading || leadLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Conversa órfã (sem lead vinculado): estado vazio neutro, sem CTA.
  if (!lead) {
    return (
      <div className="h-full p-4 flex flex-col items-center justify-center text-center gap-3">
        <UserX className="w-8 h-8 text-muted-foreground/60" />
        <p className="text-xs text-muted-foreground">
          Esta conversa não está vinculada a um lead no CRM.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full p-4 space-y-4 overflow-y-auto">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Lead
        </h3>
        <p className="text-sm font-medium">{lead.name ?? "Sem nome"}</p>
      </div>

      <div className="space-y-1.5 text-xs">
        {lead.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-3 h-3" /> {lead.phone}
          </div>
        )}
        {lead.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-3 h-3" /> {lead.email}
          </div>
        )}
        {lead.temperature && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Thermometer className="w-3 h-3" />
            <Badge variant="outline" className="text-[10px] h-4">{lead.temperature}</Badge>
          </div>
        )}
      </div>

      {lead.estimated_value != null && (
        <div>
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase">Valor estimado</h4>
          <p className="text-sm">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(lead.estimated_value)}
          </p>
        </div>
      )}
    </div>
  );
}
