import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_ALERT_EMAIL = Deno.env.get("ADMIN_ALERT_EMAIL");
const PLATFORM_FROM_EMAIL = Deno.env.get("PLATFORM_FROM_EMAIL") || "no-reply@portadocorretor.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data, attribution } = await req.json();

    if (!ADMIN_ALERT_EMAIL || !RESEND_API_KEY) {
      console.error("[platform-alerts] Missing ADMIN_ALERT_EMAIL or RESEND_API_KEY");
      return new Response(JSON.stringify({ error: "Service not configured" }), { status: 500 });
    }

    let subject = "";
    let html = "";

    const attributionHtml = attribution ? `
      <h3 style="color:#1a73e8;border-bottom:1px solid #e0e0e0;padding-bottom:8px;">📊 Rastreabilidade (Marketing)</h3>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <tr style="background:#f8f9fa;"><td style="padding:6px 10px;font-weight:bold;">Origem (utm_source)</td><td style="padding:6px 10px;">${attribution.utm_source || "(direto)"}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold;">Meio (utm_medium)</td><td style="padding:6px 10px;">${attribution.utm_medium || "-"}</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:6px 10px;font-weight:bold;">Campanha (utm_campaign)</td><td style="padding:6px 10px;">${attribution.utm_campaign || "-"}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold;">Conteúdo/Criativo (utm_content)</td><td style="padding:6px 10px;">${attribution.utm_content || "-"}</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:6px 10px;font-weight:bold;">Termo/Público (utm_term)</td><td style="padding:6px 10px;">${attribution.utm_term || "-"}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold;">fbclid</td><td style="padding:6px 10px;">${attribution.fbclid || "-"}</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:6px 10px;font-weight:bold;">gclid</td><td style="padding:6px 10px;">${attribution.gclid || "-"}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold;">Página de entrada</td><td style="padding:6px 10px;">${attribution.landing_page || "-"}</td></tr>
        <tr style="background:#f8f9fa;"><td style="padding:6px 10px;font-weight:bold;">Referrer</td><td style="padding:6px 10px;">${attribution.referrer || "-"}</td></tr>
        <tr><td style="padding:6px 10px;font-weight:bold;">Primeira visita</td><td style="padding:6px 10px;">${attribution.first_seen_at || "-"}</td></tr>
      </table>
    ` : "<p><em>Sem dados de rastreabilidade (acesso direto ou UTMs não capturados).</em></p>";

    if (type === "signup") {
      const source = attribution?.utm_source ? ` [via ${attribution.utm_source}/${attribution.utm_campaign || 'direct'}]` : '';
      subject = `🚀 Novo Cadastro: ${data.name}${source}`;
      html = `
        <h2>Novo usuário cadastrado na plataforma</h2>
        <ul>
          <li><b>Nome:</b> ${data.name}</li>
          <li><b>E-mail:</b> ${data.email}</li>
          <li><b>Telefone:</b> ${data.phone || "-"}</li>
          <li><b>Empresa:</b> ${data.company_name || "-"}</li>
          <li><b>Plano:</b> ${data.selected_plan || "-"}</li>
          <li><b>Data:</b> ${new Date().toLocaleString("pt-BR")}</li>
        </ul>
        ${attributionHtml}
      `;
    } else if (type === "lead") {
      subject = `🎯 Novo Lead Público: ${data.name}`;
      html = `
        <h2>Lead captado pelo site/portal</h2>
        <ul>
          <li><b>Nome:</b> ${data.name}</li>
          <li><b>E-mail:</b> ${data.email || "-"}</li>
          <li><b>Telefone:</b> ${data.phone || "-"}</li>
          <li><b>Organização ID:</b> ${data.organization_id}</li>
          <li><b>Origem informada:</b> ${data.source || "-"}</li>
          <li><b>Data:</b> ${new Date().toLocaleString("pt-BR")}</li>
        </ul>
        ${attributionHtml}
      `;
    } else if (type === "payment_attempt") {
      subject = `🔥 Tentativa de Pagamento: ${data.name}`;
      html = `
        <h2>O usuário iniciou o processo de checkout</h2>
        <p><b>Atenção:</b> Este lead está quente! Ele abriu a tela de pagamento.</p>
        <ul>
          <li><b>Usuário:</b> ${data.name}</li>
          <li><b>E-mail:</b> ${data.email}</li>
          <li><b>Organização:</b> ${data.organization_name || "-"}</li>
          <li><b>Plano:</b> ${data.plan_name}</li>
          <li><b>Valor:</b> R$ ${(data.amount_cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</li>
          <li><b>Ciclo:</b> ${data.billing_cycle === "yearly" ? "Anual" : "Mensal"}</li>
          <li><b>Método:</b> ${data.payment_method || "-"}</li>
          <li><b>Data:</b> ${new Date().toLocaleString("pt-BR")}</li>
        </ul>
        ${attributionHtml}
      `;
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Alertas Habitae <${PLATFORM_FROM_EMAIL}>`,
        to: [ADMIN_ALERT_EMAIL],
        subject,
        html,
      }),
    });

    const result = await res.json();
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: res.ok ? 200 : 400,
    });
  } catch (err) {
    console.error("[platform-alerts] error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
