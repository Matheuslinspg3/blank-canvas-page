import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { 
      status: 405, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate user and get organization_id
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization found" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const orgId = profile.organization_id;

    // Get Meta account
    const { data: account } = await supabase
      .from("ad_accounts")
      .select("*")
      .eq("organization_id", orgId)
      .eq("provider", "meta")
      .eq("is_active", true)
      .maybeSingle();

    if (!account?.auth_payload?.access_token) {
      return new Response(JSON.stringify({ error: "Meta account not connected" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const accessToken = account.auth_payload.access_token;

    // Call Facebook API to subscribe pages
    const result = await subscribeLeadgenWebhooks(accessToken, orgId);

    // Update auth_payload with realtime status
    const realtimeStatus = result.needs_reconnect ? "needs_reconnect" : (result.subscribed > 0 ? "enabled" : "attention");
    
    await supabase
      .from("ad_accounts")
      .update({
        auth_payload: {
          ...account.auth_payload,
          meta_realtime: {
            status: realtimeStatus,
            pages_checked: result.pages_checked,
            subscribed: result.subscribed,
            failed: result.failed,
            checked_at: new Date().toISOString()
          }
        }
      })
      .eq("organization_id", orgId)
      .eq("provider", "meta");

    return new Response(JSON.stringify({ ...result, realtime_status: realtimeStatus }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (err: any) {
    console.error("Error in meta-resubscribe-leadgen:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

async function subscribeLeadgenWebhooks(accessToken: string, orgId: string) {
  console.log(`[meta-resubscribe] Subscribing pages for org ${orgId}...`);
  
  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&limit=100&access_token=${accessToken}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      console.error("[meta-resubscribe] Error fetching pages:", JSON.stringify(pagesData.error));
      const isPermissionError = [190, 200, 10, 100].includes(pagesData.error.code) || 
                                pagesData.error.message?.toLowerCase().includes("permission");
      return { 
        success: false, 
        needs_reconnect: isPermissionError, 
        error: sanitizeMetaError(pagesData.error),
        pages_checked: 0,
        subscribed: 0,
        failed: 0
      };
    }

    const pages = pagesData.data || [];
    let subscribed = 0;
    let failed = 0;
    const results = [];

    for (const page of pages) {
      const pageId = page.id;
      const pageAccessToken = page.access_token;

      if (!pageAccessToken) {
        failed++;
        results.push({ page_id: pageId, success: false, error: "No page access token" });
        continue;
      }

      try {
        const subRes = await fetch(
          `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps?subscribed_fields=leadgen&access_token=${pageAccessToken}`,
          { method: "POST" }
        );
        const subData = await subRes.json();

        if (subData.success) {
          subscribed++;
          results.push({ page_id: pageId, success: true });
        } else {
          failed++;
          results.push({ page_id: pageId, success: false, error: sanitizeMetaError(subData.error) });
        }
      } catch (err: any) {
        failed++;
        results.push({ page_id: pageId, success: false, error: err.message });
      }
    }

    return {
      success: subscribed > 0,
      pages_checked: pages.length,
      subscribed,
      failed,
      needs_reconnect: false,
      results
    };
  } catch (err: any) {
    console.error("[meta-resubscribe] Unexpected error:", err);
    return { success: false, error: err.message, needs_reconnect: false, pages_checked: 0, subscribed: 0, failed: 0 };
  }
}

function sanitizeMetaError(error: any) {
  if (!error) return "Unknown error";
  return {
    code: error.code,
    subcode: error.error_subcode,
    type: error.type,
    message: error.message
  };
}
