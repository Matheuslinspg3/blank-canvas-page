import { supabase } from "@/integrations/supabase/client";
import type { ChannelAccount, ChannelType } from "@/types/omnichannel";

export async function listChannelAccounts(params?: {
  organizationId?: string;
  channelType?: ChannelType;
}): Promise<ChannelAccount[]> {
  let q = supabase
    .from("channel_accounts" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (params?.organizationId) q = q.eq("organization_id", params.organizationId);
  if (params?.channelType) q = q.eq("channel_type", params.channelType);

  const { data, error } = await q;
  if (error) throw error;
  return (data as any) as ChannelAccount[];
}

export async function getChannelAccount(id: string): Promise<ChannelAccount | null> {
  const { data, error } = await supabase
    .from("channel_accounts" as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as any) as ChannelAccount | null;
}
