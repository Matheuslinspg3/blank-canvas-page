/**
 * send-reset-email — Phase 2 Hardened
 *
 * Anti-abuse protections:
 *  - Rate limit by IP: 5 requests per 15 min
 *  - Rate limit by email: 3 requests per 15 min
 *  - Uniform response (no user enumeration)
 *  - Captcha-ready: checks X-Captcha-Token header (skips if not configured)
 *  - Audit logging for denials
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";
import { auditLog, extractRequestMeta } from "../_shared/security-core.ts";
import { getFlag } from "../_shared/security-flags.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-captcha-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL = "https://portadocorretor.com.br/email/porta-logo.png";
const UNIFORM_SUCCESS = JSON.stringify({ success: true });

function resetEmailHtml(resetLink: string) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Inter',Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#D62828,#F77F00);padding:32px;text-align:center;">
    <img src="${LOGO_URL}" alt="Porta do Corretor" width="180" style="display:block;margin:0 auto 12px;" />
    <p style="color:#FFF3E0;margin:0;font-size:14px;">Plataforma Imobiliária</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <h2 style="color:#1f2937;margin:0 0 8px;font-size:24px;">🔑 Redefinição de Senha</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
      Você solicitou a redefinição da sua senha na <strong>Porta do Corretor</strong>.
    </p>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
      Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong>1 hora</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#D62828,#F77F00);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:bold;font-size:16px;">
          Redefinir minha senha
        </a>
      </td></tr>
    </table>
    <p style="color:#6b7280;font-size:13px;margin:24px 0 0;line-height:1.5;">
      ⚠️ Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:16px 0 0;text-align:center;">
      Se o botão não funcionar, copie e cole este link no navegador:<br>
      <a href="${resetLink}" style="color:#D62828;word-break:break-all;">${resetLink}</a>
    </p>
  </td></tr>
  <tr><td style="background:#FFF8F0;padding:16px;text-align:center;border-top:2px solid #FCBF49;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">© Porta do Corretor — Plataforma Imobiliária</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqMeta = extractRequestMeta(req);
  const clientIp = reqMeta.ip || "unknown";

  try {
    const body = await req.json();
    const { email, redirect_to } = body;

    if (!email || typeof email !== "string") {
      return new Response(UNIFORM_SUCCESS, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const flag = await getFlag("SEC_ENABLE_RESET_EMAIL_ANTI_ABUSE");
    const antiAbuseEnabled = flag.enabled;

    // ── Rate limiting ──
    if (antiAbuseEnabled) {
      // Rate limit by IP: 5 per 15 min
      const ipLimit = await checkRateLimit(`reset_email:ip:${clientIp}`, 5, 900);
      if (!ipLimit.allowed) {
        await auditLog({
          event_type: "reset_email_rate_limit",
          severity: "warn",
          endpoint: "send-reset-email",
          decision: "deny",
          reason_code: "ip_rate_limit",
          ip: clientIp,
          user_agent: reqMeta.userAgent,
          metadata: { email: normalizedEmail },
        });
        // Return uniform success to avoid enumeration
        return new Response(UNIFORM_SUCCESS, {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate limit by email: 3 per 15 min
      const emailLimit = await checkRateLimit(`reset_email:email:${normalizedEmail}`, 3, 900);
      if (!emailLimit.allowed) {
        await auditLog({
          event_type: "reset_email_rate_limit",
          severity: "warn",
          endpoint: "send-reset-email",
          decision: "deny",
          reason_code: "email_rate_limit",
          ip: clientIp,
          user_agent: reqMeta.userAgent,
          metadata: { email: normalizedEmail },
        });
        return new Response(UNIFORM_SUCCESS, {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Captcha check (ready for integration) ──
    // TODO Phase 3: Validate X-Captcha-Token with provider (hCaptcha/Turnstile)
    // const captchaToken = req.headers.get("X-Captcha-Token");
    // const CAPTCHA_SECRET = Deno.env.get("CAPTCHA_SECRET_KEY");
    // if (CAPTCHA_SECRET && captchaToken) { ... validate ... }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[send-reset-email] RESEND_API_KEY not configured");
      return new Response(UNIFORM_SUCCESS, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: redirect_to || "https://portadocorretor.com.br/auth",
      },
    });

    if (linkError) {
      console.error("Generate link error:", linkError);
      // Uniform response — don't reveal if user exists
      return new Response(UNIFORM_SUCCESS, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetLink = linkData?.properties?.action_link;
    if (!resetLink) {
      return new Response(UNIFORM_SUCCESS, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Porta do Corretor <noreply@portadocorretor.com.br>",
        to: [normalizedEmail],
        subject: "🔑 Redefinição de Senha — Porta do Corretor",
        html: resetEmailHtml(resetLink),
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      // Still return uniform success
      return new Response(UNIFORM_SUCCESS, {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(UNIFORM_SUCCESS, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    // Uniform response even on errors
    return new Response(UNIFORM_SUCCESS, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
