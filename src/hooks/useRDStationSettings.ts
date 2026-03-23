import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Tables } from "@/integrations/supabase/types";

type RDStationSettings = Tables<"rd_station_settings">;
type RDStationUpdatePayload = Partial<Pick<RDStationSettings,
  "auto_send_to_crm" | "default_stage_id" | "default_source" |
  "api_public_key" | "api_private_key" | "is_active" |
  "oauth_access_token" | "oauth_refresh_token" | "oauth_token_expires_at" | "oauth_client_id" |
  "webhook_secret"
>>;

export function useRDStationSettings() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["rd-station-settings", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("rd_station_settings")
        .select("id, organization_id, is_active, auto_send_to_crm, default_stage_id, default_source, api_public_key, api_private_key, oauth_access_token, oauth_refresh_token, oauth_token_expires_at, oauth_client_id, webhook_secret, created_at, updated_at")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: webhookLogs = [] } = useQuery({
    queryKey: ["rd-station-logs", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("rd_station_webhook_logs")
        .select("id, organization_id, event_type, payload, status, error_message, created_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const createSettings = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("Sem organização");
      const { error } = await supabase
        .from("rd_station_settings")
        .insert({ organization_id: orgId, is_active: true, auto_send_to_crm: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (payload: RDStationUpdatePayload) => {
      if (!settings?.id) return;
      const { error } = await supabase
        .from("rd_station_settings")
        .update(payload)
        .eq("id", settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rd-station-settings"] });
    },
  });

  const hasOAuth = !!settings?.oauth_access_token;
  const oauthExpired = hasOAuth && settings?.oauth_token_expires_at &&
    new Date(settings.oauth_token_expires_at) < new Date();

  return {
    settings,
    isLoading,
    webhookLogs,
    orgId,
    createSettings,
    updateSettings,
    queryClient,
    hasOAuth,
    oauthExpired,
  };
}
