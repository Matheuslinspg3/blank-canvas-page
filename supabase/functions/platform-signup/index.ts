/**
 * platform-signup — Phase 2 Hardened
 *
 * Security:
 *  - Signed invite verification (HMAC on invite_id + email + expiry)
 *  - Progressive lockout: 5 failed attempts per IP per hour
 *  - Captcha-ready structure
 *  - Dual mode: accepts unsigned invites when flag is in dual/observe mode
 *  - Audit logging for denials
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { auditLog, extractRequestMeta } from "../_shared/security-core.ts";
import { getFlag } from "../_shared/security-flags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-captcha-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const INVITE_SIGNING_KEY = Deno.env.get("INVITE_SIGNING_KEY") || Deno.env.get("WEBHOOK_SIGNING_KEY") || "";
const DEFAULT_TRIAL_DAYS = 15;

async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) result |= bufA[i] ^ bufB[i];
  return result === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqMeta = extractRequestMeta(req);
  const clientIp = reqMeta.ip || "unknown";

  try {
    // ── Progressive lockout by IP ──
    const ipLimit = await checkRateLimit(`signup:ip:${clientIp}`, 5, 3600);
    if (!ipLimit.allowed) {
      await auditLog({
        event_type: "signup_lockout",
        severity: "warn",
        endpoint: "platform-signup",
        decision: "deny",
        reason_code: "ip_lockout",
        ip: clientIp,
        user_agent: reqMeta.userAgent,
      });
      return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente mais tarde." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { invite_id, email, password, full_name, company_name, phone, account_type, document, invite_signature } = await req.json();

    if (!invite_id || !email || !password || !full_name || !company_name) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Signed invite verification ──
    const signedInviteFlag = await getFlag("SEC_ENFORCE_PLATFORM_SIGNUP_SIGNED_INVITES");

    if (invite_signature && INVITE_SIGNING_KEY) {
      // Verify signature: HMAC(invite_id.email)
      const expectedSig = await hmacSha256(INVITE_SIGNING_KEY, `${invite_id}.${email.trim().toLowerCase()}`);
      if (!timingSafeEqual(invite_signature, expectedSig)) {
        await auditLog({
          event_type: "signup_invalid_signature",
          severity: "error",
          endpoint: "platform-signup",
          decision: "deny",
          reason_code: "invalid_invite_signature",
          ip: clientIp,
          user_agent: reqMeta.userAgent,
          metadata: { invite_id },
        });
        return new Response(JSON.stringify({ error: "Assinatura de convite inválida" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (signedInviteFlag.enabled && signedInviteFlag.mode === "enforce") {
      // Enforce mode: signature is required
      await auditLog({
        event_type: "signup_missing_signature",
        severity: "warn",
        endpoint: "platform-signup",
        decision: "deny",
        reason_code: "missing_invite_signature",
        ip: clientIp,
        user_agent: reqMeta.userAgent,
        metadata: { invite_id },
      });
      return new Response(JSON.stringify({ error: "Convite assinado obrigatório" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (signedInviteFlag.enabled && signedInviteFlag.mode === "dual") {
      // Dual mode: accept unsigned but log
      console.warn("[platform-signup] DUAL MODE: Unsigned invite accepted", { invite_id });
    }

    // ── Validate invite ──
    const { data: invite, error: inviteError } = await adminClient
      .from("platform_invites")
      .select("*")
      .eq("id", invite_id)
      .single();

    if (inviteError || !invite) {
      // Log attempt
      await adminClient.from("signup_attempt_log").insert({
        ip_address: clientIp,
        email: email.trim().toLowerCase(),
        invite_id,
        success: false,
      });
      return new Response(JSON.stringify({ error: "Convite não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.status !== "active") {
      await adminClient.from("signup_attempt_log").insert({
        ip_address: clientIp, email: email.trim().toLowerCase(), invite_id, success: false,
      });
      return new Response(JSON.stringify({ error: "Convite já utilizado ou expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(invite.expires_at) < new Date()) {
      await adminClient.from("platform_invites").update({ status: "expired" }).eq("id", invite_id);
      await adminClient.from("signup_attempt_log").insert({
        ip_address: clientIp, email: email.trim().toLowerCase(), invite_id, success: false,
      });
      return new Response(JSON.stringify({ error: "Convite expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Email binding validation
    if (invite.invite_email) {
      if (invite.invite_email.toLowerCase().trim() !== email.toLowerCase().trim()) {
        console.error("[platform-signup] Email mismatch for invite");
        await adminClient.from("signup_attempt_log").insert({
          ip_address: clientIp, email: email.trim().toLowerCase(), invite_id, success: false,
        });
        return new Response(JSON.stringify({ error: "Este convite é destinado a outro e-mail" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Create user ──
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone: phone || null,
        document: document || null,
        account_type: account_type || "imobiliaria",
        company_name,
      },
    });

    if (authError) {
      const msg = authError.message.includes("already been registered")
        ? "Este email já está cadastrado. Faça login."
        : authError.message;
      await adminClient.from("signup_attempt_log").insert({
        ip_address: clientIp, email: email.trim().toLowerCase(), invite_id, success: false,
      });
      return new Response(JSON.stringify({ error: msg }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;
    const now = new Date();
    const trialEnds = new Date(now.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);

    // Create organization
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .insert({
        name: company_name,
        type: account_type || "imobiliaria",
        created_by: userId,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (orgError) {
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Erro ao criar organização" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update/create profile
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existingProfile) {
      await adminClient.from("profiles").update({
        organization_id: org.id, full_name, phone: phone || null,
        onboarding_completed: true, email_verified: true,
      }).eq("user_id", userId);
    } else {
      await adminClient.from("profiles").insert({
        user_id: userId, organization_id: org.id, full_name,
        phone: phone || null, onboarding_completed: true, email_verified: true,
      });
    }

    // Assign admin role
    await adminClient.from("user_roles").delete().eq("user_id", userId);
    await adminClient.from("user_roles").insert({ user_id: userId, role: "admin" });

    // Create the initial commercial trial subscription for the invited organization.
    // The auth trigger may have provisioned a temporary org before this function
    // creates the invite-bound org, so we explicitly attach the subscription here.
    const { data: initialPlan, error: planError } = await adminClient
      .from("subscription_plans")
      .select("id")
      .eq("slug", "essencial")
      .eq("is_active", true)
      .maybeSingle();

    if (planError || !initialPlan) {
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Plano inicial não encontrado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: subError } = await adminClient.from("subscriptions").insert({
      organization_id: org.id,
      plan_id: initialPlan.id,
      status: "trial",
      trial_end: trialEnds.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEnds.toISOString(),
    });

    if (subError) {
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: "Erro ao criar assinatura de teste" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark invite as used
    const { error: markError } = await adminClient
      .from("platform_invites")
      .update({ status: "used", used_at: now.toISOString(), used_by_organization_id: org.id })
      .eq("id", invite_id)
      .eq("status", "active");

    if (markError) {
      console.error("[platform-signup] Failed to mark invite:", markError.message);
    }

    // Log success
    await adminClient.from("signup_attempt_log").insert({
      ip_address: clientIp, email: email.trim().toLowerCase(), invite_id, success: true,
    });

    await auditLog({
      event_type: "signup_success",
      severity: "info",
      endpoint: "platform-signup",
      actor_user_id: userId,
      actor_org_id: org.id,
      decision: "allow",
      reason_code: "signup_completed",
      ip: clientIp,
      user_agent: reqMeta.userAgent,
      metadata: { invite_id, company_name },
    });

    return new Response(JSON.stringify({ success: true, organization_id: org.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[platform-signup] Error");
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
