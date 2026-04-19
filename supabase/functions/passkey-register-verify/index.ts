// Edge Function: passkey-register-verify
// Valida attestation e persiste a credencial em user_passkeys.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyRegistrationResponse } from "npm:@simplewebauthn/server@10.0.1";
import { RP_ID, EXPECTED_ORIGINS } from "../_shared/webauthn.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const { credential, deviceName } = body as {
      credential: any;
      deviceName?: string;
    };
    if (!credential) {
      return new Response(JSON.stringify({ error: "credential required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Recupera o challenge mais recente não consumido
    const { data: chal } = await admin
      .from("webauthn_challenges")
      .select("id, challenge, expires_at, consumed_at")
      .eq("user_id", userId)
      .eq("type", "registration")
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!chal) {
      return new Response(JSON.stringify({ error: "Challenge expirado ou inexistente" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: chal.challenge,
      expectedOrigin: EXPECTED_ORIGINS,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return new Response(JSON.stringify({ error: "Falha ao verificar passkey" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { credential: cred, credentialBackedUp, aaguid } = verification.registrationInfo;

    // Persistir credencial
    const { error: insErr } = await admin.from("user_passkeys").insert({
      user_id: userId,
      credential_id: cred.id,
      public_key: btoa(String.fromCharCode(...cred.publicKey)),
      counter: cred.counter,
      transports: cred.transports ?? [],
      device_name: deviceName ?? "Dispositivo",
      aaguid: aaguid && aaguid !== "00000000-0000-0000-0000-000000000000" ? aaguid : null,
      backed_up: credentialBackedUp,
    });

    if (insErr) {
      console.error("[passkey-register-verify] insert error", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Marcar challenge como consumido
    await admin
      .from("webauthn_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", chal.id);

    // Telemetria
    try {
      await admin.from("audit_logs").insert({
        organization_id: "00000000-0000-0000-0000-000000000000",
        user_id: userId,
        action: "passkey_registered",
        entity_type: "passkey",
        entity_ids: [cred.id],
        details: { device_name: deviceName ?? "Dispositivo" },
      });
    } catch (_) { /* audit best-effort */ }

    return new Response(JSON.stringify({ verified: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[passkey-register-verify]", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
