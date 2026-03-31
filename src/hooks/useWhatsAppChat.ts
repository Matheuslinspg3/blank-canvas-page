import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWhatsAppAgentConfig } from "./useWhatsAppAgentConfig";
import { toast } from "sonner";

export interface ChatMessage {
  id: string;
  organization_id: string;
  instance_name: string;
  remote_jid: string;
  from_me: boolean;
  message_text: string | null;
  message_type: string;
  message_id: string | null;
  timestamp: string;
  created_at: string;
}

export interface ChatConversation {
  remote_jid: string;
  last_message: string | null;
  last_timestamp: string;
  unread_count: number;
}

export function useWhatsAppChat() {
  const { profile } = useAuth();
  const { config } = useWhatsAppAgentConfig();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;
  const [selectedJid, setSelectedJid] = useState<string | null>(null);

  // Fetch all messages for the org
  const { data: allMessages = [], isLoading } = useQuery({
    queryKey: ["whatsapp-messages", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("whatsapp_messages" as any)
        .select("*")
        .eq("organization_id", orgId)
        .order("timestamp", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data as any[]) as ChatMessage[];
    },
    enabled: !!orgId,
    refetchInterval: 10000, // poll every 10s
  });

  // Group into conversations
  const conversations: ChatConversation[] = (() => {
    const map = new Map<string, ChatConversation>();
    for (const msg of allMessages) {
      const existing = map.get(msg.remote_jid);
      if (!existing || msg.timestamp > existing.last_timestamp) {
        map.set(msg.remote_jid, {
          remote_jid: msg.remote_jid,
          last_message: msg.message_text,
          last_timestamp: msg.timestamp,
          unread_count: 0,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.last_timestamp).getTime() - new Date(a.last_timestamp).getTime()
    );
  })();

  // Messages for selected conversation
  const selectedMessages = selectedJid
    ? allMessages.filter((m) => m.remote_jid === selectedJid)
    : [];

  // Send message
  const sendMutation = useMutation({
    mutationFn: async ({ phone, message }: { phone: string; message: string }) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { phone, message },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onMutate: async ({ phone, message }) => {
      // Optimistic update: add message to cache immediately
      const remoteJid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
      const optimisticMsg: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        organization_id: orgId || "",
        instance_name: config?.instance_name || "",
        remote_jid: remoteJid,
        from_me: true,
        message_text: message,
        message_type: "text",
        message_id: null,
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      await queryClient.cancelQueries({ queryKey: ["whatsapp-messages", orgId] });
      const previous = queryClient.getQueryData<ChatMessage[]>(["whatsapp-messages", orgId]);
      queryClient.setQueryData<ChatMessage[]>(["whatsapp-messages", orgId], (old = []) => [
        ...old,
        optimisticMsg,
      ]);
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(["whatsapp-messages", orgId], context.previous);
      }
      toast.error("Erro ao enviar: " + err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages", orgId] });
    },
  });

  const sendMessage = useCallback(
    (message: string) => {
      if (!selectedJid) {
        console.warn("[WhatsAppChat] No selectedJid, cannot send");
        toast.error("Selecione uma conversa antes de enviar.");
        return;
      }
      const phone = selectedJid.replace("@s.whatsapp.net", "").replace("@c.us", "");
      console.log("[WhatsAppChat] sendMessage calling mutate", { phone, message, selectedJid });
      sendMutation.mutate({ phone, message });
    },
    [selectedJid, sendMutation]
  );

  // Realtime subscription
  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel("whatsapp-messages-realtime")
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, queryClient]);

  const sendToPhone = useCallback(
    (phone: string, message: string) => {
      const cleanPhone = phone.replace(/\D/g, "");
      console.log("[WhatsAppChat] sendToPhone", { cleanPhone, message });
      sendMutation.mutate({ phone: cleanPhone, message });
    },
    [sendMutation]
  );

  return {
    conversations,
    selectedJid,
    setSelectedJid,
    selectedMessages,
    sendMessage,
    sendToPhone,
    isSending: sendMutation.isPending,
    isLoading,
  };
}
