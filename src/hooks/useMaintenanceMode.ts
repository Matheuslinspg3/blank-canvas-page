import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MaintenanceConfig {
  maintenance_mode: boolean;
  maintenance_message: string;
  maintenance_started_at: string | null;
  maintenance_started_by: string | null;
  force_logout_at: string | null;
  updated_at: string;
}

export function useMaintenanceMode() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["maintenance-mode"],
    queryFn: async (): Promise<MaintenanceConfig> => {
      const { data, error } = await supabase
        .from("app_runtime_config")
        .select("*")
        .eq("id", "singleton")
        .single();

      if (error) throw error;
      return data as MaintenanceConfig;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchInterval: 120_000, // PERF: reduced from 30s to 2min, realtime handles instant updates
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Realtime subscription for instant propagation
  useEffect(() => {
    const channel = supabase
      .channel("maintenance-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "app_runtime_config",
          filter: "id=eq.singleton",
        },
        (payload) => {
          // Instantly update the cache with the new data
          queryClient.setQueryData(["maintenance-mode"], payload.new as MaintenanceConfig);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fail-OPEN: if query fails (e.g. Supabase 504 timeout), do NOT block users.
  // Previously fail-secure caused false maintenance pages during Supabase slowdowns.
  const isMaintenanceMode = data?.maintenance_mode ?? false;
  const maintenanceMessage = data?.maintenance_message ?? "Estamos em manutenção. Tente novamente em alguns minutos.";

  return {
    isMaintenanceMode,
    maintenanceMessage,
    maintenanceStartedAt: data?.maintenance_started_at ?? null,
    maintenanceStartedBy: data?.maintenance_started_by ?? null,
    forceLogoutAt: data?.force_logout_at ?? null,
    isLoading,
    error,
    refetch,
  };
}
