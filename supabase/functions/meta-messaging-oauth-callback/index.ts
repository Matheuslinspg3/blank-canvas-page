// Phase 3B: Meta Messaging OAuth callback (separate from Ads OAuth)
// Connects Instagram Direct + Facebook Messenger pages as channel_accounts.
// Behind feature flag `meta_messaging_enabled`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StateData {
  user_id: string;
  org_id: string;
  origin?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");

    if (errorParam) return redirect("?meta_msg_error=" + encodeURIComponent(errorParam));
    if (!code || !state) return redirect("?meta_msg_error=missing_params");

    let stateData: StateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return redirect("?meta_msg_error=invalid_state");
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify multi-tenant integrity
    const { data: memberCheck } = await admin
      .from("profiles")
      .select("user_id")
      .eq("user_id", stateData.user_id)
      .eq("organization_id", stateData.org_id)
      .maybeSingle();
    if (!memberCheck) return redirect("?meta_msg_error=invalid_state", stateData.origin);

    // Feature flag gate
    const { data: flag } = await admin
      .from("omnichannel_feature_flags")
      .select("meta_messaging_enabled")
      .eq("organization_id", stateData.org_id)
      .maybeSingle();
    if (!flag?.meta_messaging_enabled) {
      return redirect("?meta_msg_error=feature_disabled", stateData.origin);
    }

    const appId = Deno.env.get("META_APP_ID");
    const appSecret = Deno.env.get("META_APP_SECRET");
    if (!appId || !appSecret) return redirect("?meta_msg_error=server_config", stateData.origin);

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-messaging-oauth-callback`;

    // 1) short-lived token
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenRes = await fetch(tokenUrl.toString());
    const tokenJson = await tokenRes.json();
    if (!tokenJson.access_token) {
      console.error("token_exchange_failed", tokenJson);
      return redirect("?meta_msg_error=token_exchange", stateData.origin);
    }

    // 2) long-lived
    const llUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    llUrl.searchParams.set("grant_type", "fb_exchange_token");
    llUrl.searchParams.set("client_id", appId);
    llUrl.searchParams.set("client_secret", appSecret);
    llUrl.searchParams.set("fb_exchange_token", tokenJson.access_token);
    const llRes = await fetch(llUrl.toString());
    const llJson = await llRes.json();
    const userToken: string = llJson.access_token || tokenJson.access_token;
    const expiresAt = llJson.expires_in
      ? new Date(Date.now() + Number(llJson.expires_in) * 1000).toISOString()
      : null;

    // 3) list pages (each has its own page-token)
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${userToken}`,
    );
    const pagesJson = await pagesRes.json();
    if (pagesJson.error) {
      console.error("pages_fetch_failed", pagesJson.error);
      return redirect("?meta_msg_error=pages_fetch", stateData.origin);
    }
    const pages: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }> = pagesJson.data || [];

    if (pages.length === 0) {
      return redirect("?meta_msg_error=no_pages", stateData.origin);
    }

    let connectedCount = 0;

    for (const page of pages) {
      // Messenger channel account
      const messengerAccount = await upsertChannelAccount(admin, {
        organizationId: stateData.org_id,
        channelType: "messenger",
        externalId: page.id,
        displayName: page.name,
      });
      if (messengerAccount) {
        await admin.from("channel_account_credentials").upsert(
          {
            channel_account_id: messengerAccount.id,
            organization_id: stateData.org_id,
            provider: "meta",
            access_token: page.access_token,
            token_type: "page",
            expires_at: expiresAt,
            scopes: [
              "pages_messaging",
              "pages_manage_metadata",
              "pages_show_list",
              "pages_read_engagement",
            ],
            external_page_id: page.id,
            metadata: { connected_by: stateData.user_id },
            last_refreshed_at: new Date().toISOString(),
          },
          { onConflict: "channel_account_id" },
        );
        connectedCount++;
      }

      // Instagram channel account (if linked)
      if (page.instagram_business_account?.id) {
        const igAccount = await upsertChannelAccount(admin, {
          organizationId: stateData.org_id,
          channelType: "instagram",
          externalId: page.instagram_business_account.id,
          displayName: page.instagram_business_account.username || page.name,
        });
        if (igAccount) {
          await admin.from("channel_account_credentials").upsert(
            {
              channel_account_id: igAccount.id,
              organization_id: stateData.org_id,
              provider: "meta",
              access_token: page.access_token, // IG uses page token
              token_type: "page",
              expires_at: expiresAt,
              scopes: [
                "instagram_basic",
                "instagram_manage_messages",
                "pages_messaging",
              ],
              external_page_id: page.id,
              external_ig_user_id: page.instagram_business_account.id,
              metadata: { connected_by: stateData.user_id },
              last_refreshed_at: new Date().toISOString(),
            },
            { onConflict: "channel_account_id" },
          );
          connectedCount++;
        }
      }
    }

    return redirect(`?meta_msg_success=${connectedCount}`, stateData.origin);
  } catch (err) {
    console.error("meta_messaging_oauth_unexpected", err);
    return redirect("?meta_msg_error=unexpected");
  }
});

async function upsertChannelAccount(
  admin: any,
  args: {
    organizationId: string;
    channelType: "messenger" | "instagram";
    externalId: string;
    displayName: string;
  },
) {
  const { data: existing } = await admin
    .from("channel_accounts")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("channel_type", args.channelType)
    .eq("external_id", args.externalId)
    .maybeSingle();

  if (existing) {
    await admin
      .from("channel_accounts")
      .update({ display_name: args.displayName, status: "connected" })
      .eq("id", existing.id);
    return existing;
  }

  const { data: created, error } = await admin
    .from("channel_accounts")
    .insert({
      organization_id: args.organizationId,
      channel_type: args.channelType,
      external_id: args.externalId,
      display_name: args.displayName,
      status: "connected",
      metadata: {},
    })
    .select("id")
    .single();
  if (error) {
    console.error("channel_account_insert_failed", error);
    return null;
  }
  return created;
}

function redirect(params: string, origin?: string) {
  const appUrl = origin || Deno.env.get("APP_URL") || "https://portadocorretor.com.br";
  return new Response(null, {
    status: 302,
    headers: { Location: `${appUrl}/inbox${params}`, ...corsHeaders },
  });
}
