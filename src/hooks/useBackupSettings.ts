import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type BackupFrequency = "fixed_daily" | "hourly";

export interface BackupSettings {
  organization_id: string;
  enabled: boolean;
  include_photos: boolean;
  photo_original: boolean;
  photo_thumbnail: boolean;
  mirror_deletions: boolean;
  retention_days: number;
  frequency: BackupFrequency;
  run_hour: number;
  timezone: string;
  drive_account_email: string | null;
  drive_root_folder_id: string | null;
  connected_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  next_run_at: string | null;
}

export interface BackupEstimate {
  counts: { leads: number; properties: number; photos_original: number; photos_thumbnail: number };
  bytes: { data: number; photos_original: number; photos_thumbnail: number };
  scopes: {
    data_only: number;
    data_plus_original: number;
    data_plus_thumb: number;
    data_plus_both: number;
  };
  note: string | null;
}

const SETTINGS_KEY = ["backup-settings"];

export function useBackupSettings() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [...SETTINGS_KEY, orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<BackupSettings | null> => {
      const { data, error } = await supabase
        .from("backup_settings")
        .select(
          "organization_id, enabled, include_photos, photo_original, photo_thumbnail, mirror_deletions, retention_days, frequency, run_hour, timezone, drive_account_email, drive_root_folder_id, connected_at, last_run_at, last_run_status, next_run_at",
        )
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return (data as BackupSettings | null) ?? null;
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<BackupSettings>) => {
      if (!orgId) throw new Error("Sem organização");
      const { error } = await supabase
        .from("backup_settings")
        .upsert(
          { organization_id: orgId, ...patch },
          { onConflict: "organization_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...SETTINGS_KEY, orgId] });
    },
  });

  return { ...query, settings: query.data ?? null, save };
}

export function useBackupEstimate(enabled: boolean) {
  return useQuery({
    queryKey: ["backup-estimate"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<BackupEstimate> => {
      const { data, error } = await supabase.functions.invoke("estimate-backup-size");
      if (error) throw error;
      return data as BackupEstimate;
    },
  });
}

export async function startDriveOAuth(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("drive-oauth-start", {
    body: { origin: window.location.origin },
  });
  if (error) throw error;
  const url = (data as { url?: string })?.url;
  if (!url) throw new Error("Falha ao iniciar conexão com o Google Drive");
  return url;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
