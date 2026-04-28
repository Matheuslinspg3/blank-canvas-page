/**
 * send-removal-notification
 *
 * Notifies a member that their access to an organization has been revoked.
 * Called by `manage-member` immediately after a successful remove_member action.
 *
 * Auth: requires X-Internal-Secret matching SUPABASE_SERVICE_ROLE_KEY OR
 * a valid service-role bearer token. Never exposed to end users.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const LOGO_URL = "https://portadocorretor.com.br/email/porta-logo.png";

function removalEmailHtml(opts: {
  recipientName: string;
  orgName: string;
  reason?: string | null;
  removedAt: string;
}) {
  const { recipientName, orgName, reason, removedAt } = opts;
  const formattedDate = new Date(removedAt).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "long",
    timeTimeStyle: "short" as any,
  });
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
    <h2 style="color:#1f2937;margin:0 0 8px;font-size:22px;">Seu acesso foi revogado</h2>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
      Olá${recipientName ? ` <strong>${recipientName}</strong>` : ""},
    </p>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
      Informamos que seu acesso à equipe <strong>${orgName}</strong> na
      Porta do Corretor foi removido em <strong>${formattedDate}</strong>.
    </p>
    <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
      Por motivos de segurança, todas as suas sessões ativas foram encerradas
      e você não tem mais acesso ao painel desta equipe.
    </p>
    ${
      reason
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
            <tr><td style="background:#FFF8F0;border-left:4px solid #F77F00;border-radius:4px;padding:12px 16px;">
              <p style="color:#6b7280;font-size:12px;margin:0 0 4px;">Motivo informado pelo administrador</p>
              <p style="color:#1f2937;font-size:14px;margin:0;">${reason}</p>
            </td></tr>
          </table>`
        : ""
    }
    <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
      Se você acredita que isto foi um engano, entre em contato diretamente com
      o administrador da equipe <strong>${orgName}</strong>.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">
      Esta é uma notificação automática — não é necessário responder.
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

  try {
    // Internal-only: require service role key (either header)
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = req.headers.get("x-internal-secret");
    const auth = req.headers.get("authorization") || "";
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    if (internalSecret !== SERVICE_KEY && bearer !== SERVICE_KEY) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { to, recipient_name, org_name, reason, removed_at } = body ?? {};

    if (!to || !org_name) {
      return new Response(
        JSON.stringify({ error: "to and org_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      console.error("[send-removal-notification] RESEND_API_KEY missing");
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const subject = `Seu acesso à equipe ${org_name} foi revogado`;
    const html = removalEmailHtml({
      recipientName: recipient_name || "",
      orgName: org_name,
      reason: reason || null,
      removedAt: removed_at || new Date().toISOString(),
    });

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Porta do Corretor <noreply@portadocorretor.com.br>",
        to: [to],
        subject,
        html,
      }),
    });

    const data = await resendRes.json();
    if (!resendRes.ok) {
      console.error("[send-removal-notification] Resend error:", data);
      return new Response(
        JSON.stringify({ error: "Failed to send", details: data }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-removal-notification] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
