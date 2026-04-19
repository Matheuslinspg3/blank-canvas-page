import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listChannelAccounts } from "@/services/omnichannel/channelAccountsService";
import type { ChannelType } from "@/types/omnichannel";

export function useChannelAccounts(channelType?: ChannelType) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["omnichannel", "channel-accounts", orgId, channelType ?? "all"],
    queryFn: () => listChannelAccounts({ organizationId: orgId!, channelType }),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
