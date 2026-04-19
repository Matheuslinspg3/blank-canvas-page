import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Params {
  orgId: string | undefined;
  activeConversationId: string | null;
}

/**
 * Realtime híbrido enxuto:
 * - 1 canal org-wide em `conversations` (INSERT/UPDATE) -> invalida lista.
 * - 1 canal por conversa ativa em `messages` (INSERT) -> invalida thread + lista.
 *
 * Não assina `messages` org-wide (alto volume / pouco ganho — a lista já reflete
 * via UPDATE de last_message_at em conversations).
 *
 * Retorna `realtimeConnected` para que os hooks de query aumentem o intervalo
 * de polling como fallback degradado.
 */
export function useInboxRealtime({ orgId, activeConversationId }: Params) {
  const qc = useQueryClient();
  const [orgConnected, setOrgConnected] = useState(false);
  const [convConnected, setConvConnected] = useState(false);

  // Org-wide: conversations
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel(`inbox:conversations:${orgId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["omnichannel", "conversations"] });
        },
      )
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["omnichannel", "conversations"] });
        },
      )
      .subscribe((status) => {
        setOrgConnected(status === "SUBSCRIBED");
      });

    return () => {
      setOrgConnected(false);
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);

  // Per-conversation: messages
  useEffect(() => {
    if (!activeConversationId) {
      setConvConnected(false);
      return;
    }
    const channel = supabase
      .channel(`inbox:messages:${activeConversationId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        () => {
          qc.invalidateQueries({
            queryKey: ["omnichannel", "messages", activeConversationId],
          });
          qc.invalidateQueries({ queryKey: ["omnichannel", "conversations"] });
        },
      )
      .subscribe((status) => {
        setConvConnected(status === "SUBSCRIBED");
      });

    return () => {
      setConvConnected(false);
      supabase.removeChannel(channel);
    };
  }, [activeConversationId, qc]);

  return {
    realtimeConnected: orgConnected,
    threadRealtimeConnected: convConnected,
  };
}
