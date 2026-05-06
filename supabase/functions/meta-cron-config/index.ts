import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Meta Cron Config — DEPRECATED
 * 
 * We no longer use cron jobs for Meta Ads synchronization. 
 * Real-time leads are handled via the `meta-leadgen-webhook` Edge Function.
 * This function now only returns a disabled state for compatibility.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Always return disabled
  return new Response(
    JSON.stringify({ 
      enabled: false, 
      schedule: null, 
      interval_minutes: null,
      message: "Cron synchronization is deprecated in favor of real-time webhooks."
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
