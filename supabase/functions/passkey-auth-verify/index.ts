// Edge Function: passkey-auth-verify (público)
// Valida assertion contra public_key armazenada e gera magiclink → token_hash.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { verifyAuthenticationResponse } from "npm:@simplewebauthn/server@10.0.1";
import { RP_ID, EXPECTED_ORIGINS } from "../_shared/webauthn.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { credential, email } = await req.json() as { credential: any; email?: string };
    if (!credential?.id) {
      return new Response(JSON.stringify({ error: "credential required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Localizar credencial
    const { data: passkey } = await admin
      .from("user_passkeys")
      .select("id, user_id, credential_id, public_key, counter, transports")
      .eq("credential_id", credential.id)
      .maybeSingle();

    if (!passkey) {
      return new Response(JSON.stringify({ error: "Passkey desconhecida" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolver email do usuário (necessário para generateLink)
    const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(passkey.user_id);
    if (userErr || !userRes?.user?.email) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userEmail = userRes.user.email;

    // Recuperar challenge mais recente
    const challengeQuery = admin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at")
      .eq("type", "authentication")
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: chal } = email
      ? await challengeQuery.eq("email", email).maybeSingle()
      : await challengeQuery.maybeSingle();

    if (!chal) {
      return new Response(JSON.stringify({ error: "Challenge expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode public_key (base64 → Uint8Array)
    const pubKeyBytes = Uint8Array.from(atob(passkey.public_key), (c) => c.charCodeAt(0));

    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: chal.challenge,
      expectedOrigin: EXPECTED_ORIGINS,
      expectedRPID: RP_ID,
      credential: {
        id: passkey.credential_id,
        publicKey: pubKeyBytes,
        counter: Number(passkey.counter),
        transports: (passkey.transports ?? []) as AuthenticatorTransport[],
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return new Response(JSON.stringify({ error: "Verificação falhou" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Counter rollback check + atualização
    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter < Number(passkey.counter)) {
      console.warn("[passkey-auth-verify] counter rollback detectado", { passkey_id: passkey.id });
      return new Response(JSON.stringify({ error: "Possível clone detectado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("user_passkeys")
      .update({ counter: newCounter, last_used_at: new Date().toISOString() })
      .eq("id", passkey.id);

    await admin
      .from("webauthn_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", chal.id);

    // Gerar magiclink → extrair token_hash para verifyOtp no client
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userEmail,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      console.error("[passkey-auth-verify] generateLink failed", linkErr);
      return new Response(JSON.stringify({ error: "Falha ao gerar sessão" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Telemetria
    try {
      await admin.from("audit_logs").insert({
        organization_id: "00000000-0000-0000-0000-000000000000",
        user_id: passkey.user_id,
        action: "passkey_used",
        entity_type: "passkey",
        entity_ids: [passkey.credential_id],
        details: {},
      });
    } catch (_) { /* best-effort */ }

    return new Response(
      JSON.stringify({
        verified: true,
        email: userEmail,
        token_hash: linkData.properties.hashed_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[passkey-auth-verify]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
