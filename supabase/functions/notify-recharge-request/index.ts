import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/auth.ts";

const DEV_EMAIL = "matheuslinspg@gmail.com";
const APP_URL = Deno.env.get("APP_URL") ?? "https://portadocorretor.com.br";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: "request_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createServiceClient();
    const { data: req_, error } = await sb
      .from("credit_recharge_requests")
      .select("*, organizations(name)")
      .eq("id", request_id)
      .maybeSingle();

    if (error || !req_) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: requester } = await sb
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", req_.user_id)
      .maybeSingle();

    const orgName = (req_ as any).organizations?.name ?? req_.organization_id;
    const html = `
      <h2>Nova solicitação de recarga PIX</h2>
      <p><strong>Organização:</strong> ${orgName}</p>
      <p><strong>Solicitante:</strong> ${requester?.full_name ?? "—"} (${requester?.email ?? "—"})</p>
      <p><strong>Valor:</strong> R$ ${Number(req_.amount_brl).toFixed(2)}</p>
      <p><strong>Chave PIX:</strong> ${req_.pix_key}</p>
      ${req_.notes ? `<p><strong>Observações:</strong> ${req_.notes}</p>` : ""}
      ${req_.receipt_path ? `<p>Comprovante enviado (acesse pelo painel).</p>` : "<p><em>Sem comprovante anexado.</em></p>"}
      <p><a href="${APP_URL}/developer/recargas">→ Abrir painel de aprovações</a></p>
    `;

    const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_KEY}`,
        },
        body: JSON.stringify({
          from: "Porta do Corretor <noreply@notify.portadocorretor.com.br>",
          to: [DEV_EMAIL],
          subject: `Nova recarga PIX · R$ ${Number(req_.amount_brl).toFixed(2)} · ${orgName}`,
          html,
        }),
      });
      const result = await r.json();
      console.log("[notify-recharge-request] resend:", r.status, result);
      if (!r.ok) {
        return new Response(JSON.stringify({ ok: false, email_error: result }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("[notify-recharge-request] RESEND_API_KEY not set");
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[notify-recharge-request] error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
