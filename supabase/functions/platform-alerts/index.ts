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
      <h3>Rastreabilidade (Marketing)</h3>
      <ul>
        <li><b>Origem (utm_source):</b> ${attribution.utm_source || "-"}</li>
        <li><b>Meio (utm_medium):</b> ${attribution.utm_medium || "-"}</li>
        <li><b>Campanha (utm_campaign):</b> ${attribution.utm_campaign || "-"}</li>
        <li><b>Conteúdo (utm_content):</b> ${attribution.utm_content || "-"}</li>
        <li><b>Termo (utm_term):</b> ${attribution.utm_term || "-"}</li>
        <li><b>fbclid:</b> ${attribution.fbclid || "-"}</li>
        <li><b>gclid:</b> ${attribution.gclid || "-"}</li>
        <li><b>Página de entrada:</b> ${attribution.landing_page || "-"}</li>
        <li><b>Referrer:</b> ${attribution.referrer || "-"}</li>
        <li><b>Data da primeira visita:</b> ${attribution.first_seen_at || "-"}</li>
      </ul>
    ` : "<p>Sem dados de rastreabilidade.</p>";

    if (type === "signup") {
      subject = `🚀 Novo Cadastro: ${data.name}`;
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
