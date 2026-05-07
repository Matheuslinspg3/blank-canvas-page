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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { accessToken, adAccountId, disconnect } = body;

    // Use service role to write the token securely and perform background tasks
    const supa = createClient(supabaseUrl, supabaseServiceKey);

    if (disconnect) {
      const { error: discError } = await supa
        .from("ad_accounts")
        .update({ 
          status: "disconnected", 
          is_active: false, 
          auth_payload: null, 
          updated_at: new Date().toISOString() 
        })
        .eq("organization_id", profile.organization_id)
        .eq("provider", "meta");

      if (discError) {
        console.error("Disconnect error:", discError);
        return new Response(JSON.stringify({ error: "Erro ao desconectar" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!accessToken || !adAccountId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save/Update account
    const { error: dbError } = await supa
      .from("ad_accounts")
      .upsert(
        {
          organization_id: profile.organization_id,
          provider: "meta",
          external_account_id: adAccountId,
          name: `Meta Ads - ${adAccountId}`,
          is_active: true,
          auth_payload: { access_token: accessToken },
          status: "connected",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,provider" }
      );

    if (dbError) {
      console.error("DB save error:", dbError);
      return new Response(JSON.stringify({ error: "Erro ao salvar conta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Automatic Webhook Subscription ---
    // This solves the issue where leads only appear after manual import
    try {
      console.log(`[meta-save-account] Attempting auto-subscription for org ${profile.organization_id}`);
      
      // 1. Get pages for this user to subscribe their leads
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,access_token&access_token=${accessToken}`
      );
      const pagesData = await pagesRes.json();
      
      if (pagesData.data && Array.isArray(pagesData.data)) {
        for (const page of pagesData.data) {
          console.log(`[meta-save-account] Subscribing app to page ${page.id} (${page.name})`);
          
          // Subscribe the app to the page's leadgen field
          const subRes = await fetch(
            `https://graph.facebook.com/v21.0/${page.id}/subscribed_apps?subscribed_fields=leadgen&access_token=${page.access_token}`,
            { method: "POST" }
          );
          const subResult = await subRes.json();
          
          if (subResult.success) {
            console.log(`[meta-save-account] Successfully subscribed to page ${page.id}`);
          } else {
            console.error(`[meta-save-account] Failed to subscribe to page ${page.id}:`, subResult.error);
          }
        }
      }
    } catch (subErr) {
      console.error("[meta-save-account] Webhook auto-subscription error:", subErr);
      // We don't fail the whole request if subscription fails, 
      // as the account is still saved and can be imported manually as fallback.
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
