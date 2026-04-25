import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface BrokerMessage {
  id: string;
  remote_jid: string;
  from_me: boolean;
  message_text: string | null;
  message_type: string | null;
  media_url: string | null;
  timestamp: string;
  sender_type: string;
}

export interface BrokerConversation {
  remote_jid: string;
  phone: string;
  contact_name: string | null;
  last_message: string;
  last_message_at: string;
  last_from_me: boolean;
  unread_count: number;
}

const PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => any
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  return rows;
}

/**
 * Resolve current user's broker channel id (from broker_whatsapp_channels).
 */
function useMyBrokerChannelId() {
  const { user, profile } = useAuth();
  return useQuery({
    queryKey: ["my-broker-channel-id", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("broker_whatsapp_channels" as any)
        .select("id, instance_name, status")
        .eq("organization_id", profile!.organization_id!)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown) as { id: string; instance_name: string | null; status: string } | null;
    },
    enabled: !!user?.id && !!profile?.organization_id,
    staleTime: 30_000,
  });
}

/**
 * List conversations for the current broker channel, grouped by remote_jid.
 */
export function useBrokerConversations() {
  const { profile } = useAuth();
  const { data: channel } = useMyBrokerChannelId();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["broker-conversations", channel?.id],
    queryFn: async () => {
      const data = await fetchAllPages<any>((from, to) =>
        supabase
          .from("whatsapp_messages" as any)
          .select("remote_jid, from_me, message_text, message_type, timestamp, phone, push_name")
          .eq("organization_id", profile!.organization_id!)
          .eq("broker_channel_id", channel!.id)
          .order("timestamp", { ascending: false })
          .range(from, to)
      );

      const map = new Map<string, BrokerConversation>();
      const nameByJid = new Map<string, string>();
      for (const row of (data ?? []) as any[]) {
        // Capture push_name from the most recent message that has one
        const cleanName = typeof row.push_name === "string" ? row.push_name.trim() : "";
        if (cleanName && !nameByJid.has(row.remote_jid)) {
          nameByJid.set(row.remote_jid, cleanName);
        }
        if (map.has(row.remote_jid)) continue;
        const phone = row.phone ?? row.remote_jid.split("@")[0];
        const preview =
          row.message_text ??
          (row.message_type === "image"
            ? "📷 Imagem"
            : row.message_type === "audio"
            ? "🎤 Áudio"
            : row.message_type === "document"
            ? "📄 Documento"
            : "");
        map.set(row.remote_jid, {
          remote_jid: row.remote_jid,
          phone,
          contact_name: row.push_name ?? null,
          last_message: preview,
          last_message_at: row.timestamp,
          last_from_me: row.from_me,
          unread_count: 0,
        });
      }
      // Backfill names from older messages in the same scan
      for (const [jid, conv] of map.entries()) {
        if (!conv.contact_name && nameByJid.has(jid)) {
          conv.contact_name = nameByJid.get(jid)!;
        }
      }
      return Array.from(map.values());
    },
    enabled: !!channel?.id,
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!channel?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any).rpc("reprocess_broker_whatsapp_contact_names");
      if (!cancelled && Number(data ?? 0) > 0) {
        qc.invalidateQueries({ queryKey: ["broker-conversations", channel.id] });
        qc.invalidateQueries({ queryKey: ["broker-messages"] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [channel?.id, qc]);

  // Realtime: refetch on new inbound messages for this channel
  useEffect(() => {
    if (!channel?.id) return;
    const ch = supabase
      .channel(`broker-conversations-${channel.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_messages",
          filter: `broker_channel_id=eq.${channel.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["broker-conversations", channel.id] });
          qc.invalidateQueries({ queryKey: ["broker-messages"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channel?.id, qc]);

  return { ...query, channelId: channel?.id ?? null, channelStatus: channel?.status ?? null };
}

/**
 * Messages for a single conversation (remote_jid).
 */
export function useBrokerMessages(remoteJid: string | null) {
  const { profile } = useAuth();
  const { data: channel } = useMyBrokerChannelId();

  return useQuery({
    queryKey: ["broker-messages", channel?.id, remoteJid],
    queryFn: async () => {
      const data = await fetchAllPages<any>((from, to) =>
        supabase
          .from("whatsapp_messages" as any)
          .select("id, remote_jid, from_me, message_text, message_type, media_url, timestamp, sender_type")
          .eq("organization_id", profile!.organization_id!)
          .eq("broker_channel_id", channel!.id)
          .eq("remote_jid", remoteJid!)
          .order("timestamp", { ascending: true })
          .range(from, to)
      );
      return ((data ?? []) as unknown) as BrokerMessage[];
    },
    enabled: !!channel?.id && !!remoteJid,
    staleTime: 2_000,
    refetchInterval: 10_000,
  });
}

/**
 * Send message via whatsapp-broker-send edge function.
 */
export function useSendBrokerMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      phone: string;
      message: string;
      type?: "text" | "media";
      mediaUrl?: string;
      mediaType?: "image" | "audio" | "document" | "video";
      clientMessageId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-broker-send", {
        body: payload,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broker-conversations"] });
      qc.invalidateQueries({ queryKey: ["broker-messages"] });
    },
    onError: (err: any) => toast.error(err?.message ?? "Erro ao enviar"),
  });
}

export function jidToPhone(jid: string): string {
  return jid.replace(/@.*$/, "");
}

export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith("55")) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return `+${d}`;
}
