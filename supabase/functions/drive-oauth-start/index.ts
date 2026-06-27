// drive-oauth-start
// Inicia o fluxo OAuth do Google Drive para a organização (admin-only).
// Espelha o padrão do rd-station-oauth-* já existente no projeto.
//
// Decisões: scope drive.file (o app só enxerga a pasta que cria), access_type=offline
// + prompt=consent para garantir refresh_token. Apenas ADMIN da org pode conectar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientId = Deno.env.get("GOOGLE_DRIVE_OAUTH_CLIENT_ID");
    if (!clientId) {
      return json({ error: "drive_oauth_not_configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identifica o usuário pelo token
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    // Resolve org (depende de auth.uid() -> roda no contexto do usuário)
    // e checa admin via RPCs já existentes no schema.
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: orgId } = await userClient.rpc("get_user_organization_id");
    const resolvedOrg = (orgId as string | null) ?? null;
    if (!resolvedOrg) return json({ error: "no_organization" }, 400);

    const { data: isAdmin } = await admin.rpc("is_org_admin", { _user_id: userId });
    if (!isAdmin) return json({ error: "forbidden_admin_only" }, 403);

    // state assinado com a org/origin para o callback
    const body = await req.json().catch(() => ({}));
    const origin: string = body?.origin || Deno.env.get("APP_URL") || "https://portadocorretor.com.br";

    const state = btoa(JSON.stringify({
      org_id: resolvedOrg,
      user_id: userId,
      origin,
      nonce: crypto.randomUUID(),
    }));

    const redirectUri = `${supabaseUrl}/functions/v1/drive-oauth-callback`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", DRIVE_SCOPE);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    return json({ url: authUrl.toString() }, 200);
  } catch (err) {
    console.error("drive-oauth-start error:", err);
    return json({ error: "unexpected", message: String(err) }, 500);
  }
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
