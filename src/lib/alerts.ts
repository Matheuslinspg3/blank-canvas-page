import { supabase } from "@/integrations/supabase/client";
import { AttributionContext } from "@/hooks/useAttribution";

/**
 * Fires an alert email for new signups, leads, or payment attempts.
 * Uses the platform-alerts Edge Function.
 * Fails silently to ensure the main flow is not broken.
 */
export async function firePlatformAlert(
  type: 'signup' | 'lead' | 'payment_attempt',
  data: Record<string, any>,
  attribution?: AttributionContext
) {
  try {
    // Fire and forget, but log errors
    supabase.functions.invoke('platform-alerts', {
      body: { type, data, attribution }
    }).then(({ error }) => {
      if (error) {
        console.warn(`[platform-alerts] Failed to send ${type} alert:`, error);
      }
    });
  } catch (err) {
    console.warn(`[platform-alerts] Error invoking ${type} alert:`, err);
  }
}
