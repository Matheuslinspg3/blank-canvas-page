// drive-oauth-callback
// Recebe o code do Google, troca por tokens, cria a pasta raiz de backup no
// Drive do cliente (scope drive.file) e persiste em backup_settings.
// Espelha o rd-station-oauth-callback existente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ROOT_FOLDER_NAME = "Portal Corretor Backups";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  let stateData: { org_id: string; user_id: string; origin?: string } | null = null;
  try {
    if (stateRaw) stateData = JSON.parse(atob(stateRaw));
  } catch {
    stateData = null;
  }

  const origin = stateData?.origin;

  if (errorParam) {
    console.error("Google returned error:", errorParam);
    return redirectToApp("?drive_error=access_denied", origin);
  }
  if (!code || !stateData?.org_id) {
    return redirectToApp("?drive_error=invalid_request", origin);
  }

  try {
    const clientId = Deno.env.get("GOOGLE_DRIVE_OAUTH_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!clientId || !clientSecret) {
      return redirectToApp("?drive_error=not_configured", origin);
    }

    const redirectUri = `${supabaseUrl}/functions/v1/drive-oauth-callback`;

    // 1) Troca code -> tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", JSON.stringify(tokenData));
      return redirectToApp("?drive_error=token_exchange", origin);
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

    // 2) Descobre o email da conta conectada (opcional, informativo)
    let accountEmail: string | null = null;
    try {
      const infoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (infoRes.ok) accountEmail = (await infoRes.json())?.email ?? null;
    } catch (_) { /* informativo, ignora */ }

    // 3) Cria (ou localiza) a pasta raiz no Drive do cliente
    const rootFolderId = await ensureRootFolder(access_token);

    // 4) Persiste em backup_settings (upsert por org)
    const admin = createClient(supabaseUrl, serviceKey);
    const { error: dbError } = await admin
      .from("backup_settings")
      .upsert({
        organization_id: stateData.org_id,
        oauth_access_token: access_token,
        oauth_refresh_token: refresh_token ?? null,
        oauth_token_expires_at: expiresAt,
        drive_account_email: accountEmail,
        drive_root_folder_id: rootFolderId,
        connected_at: new Date().toISOString(),
        connected_by: stateData.user_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id" });

    if (dbError) {
      console.error("DB save error:", dbError);
      return redirectToApp("?drive_error=db_save", origin);
    }

    console.log("Drive connected for org:", stateData.org_id);
    return redirectToApp("?drive_success=true", origin);
  } catch (err) {
    console.error("drive-oauth-callback unexpected:", err);
    return redirectToApp("?drive_error=unexpected", origin);
  }
});

// Procura uma pasta raiz existente criada pelo app (drive.file só enxerga
// arquivos que o app criou) e cria se não houver.
async function ensureRootFolder(accessToken: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${ROOT_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&spaces=drive`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (listRes.ok) {
    const data = await listRes.json();
    if (data.files?.length) return data.files[0].id as string;
  }

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: ROOT_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Falha ao criar pasta raiz: ${createRes.status} ${await createRes.text()}`);
  }
  return (await createRes.json()).id as string;
}

function redirectToApp(params: string, origin?: string) {
  const appUrl = origin || Deno.env.get("APP_URL") || "https://portadocorretor.com.br";
  const target = `${appUrl}/settings?tab=company${params}`;
  return new Response(null, {
    status: 302,
    headers: { Location: target, ...corsHeaders },
  });
}
