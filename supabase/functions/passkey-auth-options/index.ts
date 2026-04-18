// Edge Function: passkey-auth-options (público)
// Gera challenge para autenticação. Email é opcional (descoberta resident key).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateAuthenticationOptions } from "npm:@simplewebauthn/server@10.0.1";
import { RP_ID } from "../_shared/webauthn.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json().catch(() => ({ email: undefined }));

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let allowCredentials: Array<{ id: string; transports?: AuthenticatorTransport[] }> = [];

    if (email && typeof email === "string" && email.includes("@")) {
      // Buscar user_id por email diretamente em auth.users (evita paginação de listUsers)
      const { data: userRow } = await admin
        .schema("auth" as any)
        .from("users" as any)
        .select("id")
        .ilike("email", email.trim())
        .maybeSingle();
      const foundId = (userRow as { id?: string } | null)?.id;
      if (foundId) {
        const { data: keys } = await admin
          .from("user_passkeys")
          .select("credential_id, transports")
          .eq("user_id", foundId);
        allowCredentials = (keys ?? []).map((k) => ({
          id: k.credential_id,
          transports: (k.transports ?? []) as AuthenticatorTransport[],
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: "preferred",
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    });

    await admin.from("webauthn_challenges").insert({
      challenge: options.challenge,
      email: email ?? null,
      type: "authentication",
    });

    return new Response(JSON.stringify(options), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[passkey-auth-options]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
