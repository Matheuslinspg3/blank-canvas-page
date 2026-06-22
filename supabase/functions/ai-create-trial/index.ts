/**
 * ai-create-trial — cria conta trial de 15 dias para leads, acionada pela IA
 * de atendimento (WhatsApp via n8n).
 *
 * Segurança:
 *  - Protegida por AI_TRIAL_TOKEN próprio (o n8n NÃO conhece service role nem
 *    INVITE_SIGNING_KEY).
 *  - Reaproveita o fluxo testado do platform-signup: emite internamente um
 *    platform_invites ativo + assinatura HMAC, e chama platform-signup
 *    server-to-server. Toda a lógica de org própria por lead, trial de 15 dias,
 *    rate-limit por IP, signup_attempt_log e single-use invite vem de lá.
 *  - Anti-abuso adicional: 1 trial por email/telefone (idempotência). Se o lead
 *    já tem conta, retorna um novo magic link em vez de criar outra.
 *  - Rate-limit por email e por telefone, além do IP do platform-signup.
 *  - A senha é aleatória e forte; NUNCA é retornada. O lead entra por magic link.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limiter.ts";

// Inlined (evita puxar a cadeia de deps transitivas de security-core no bundle).
function extractRequestMeta(req: Request): { ip?: string; userAgent?: string } {
  return {
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || undefined,
    userAgent: req.headers.get("user-agent") || undefined,
  };
}

async function auditLog(
  client: SupabaseClient,
  event: {
    event_type: string;
    severity: string;
    endpoint?: string;
    decision: string;
    reason_code?: string;
    ip?: string;
    user_agent?: string;
    actor_org_id?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await client.from("security_audit_events").insert({
      event_type: event.event_type,
      severity: event.severity,
      endpoint: event.endpoint ?? "ai-create-trial",
      actor_type: "service",
      actor_org_id: event.actor_org_id ?? null,
      decision: event.decision,
      reason_code: event.reason_code ?? null,
      ip: event.ip ?? null,
      user_agent: event.user_agent ?? null,
      metadata: event.metadata ?? null,
    });
  } catch (e) {
    console.error("[ai-create-trial] auditLog failed:", e instanceof Error ? e.message : String(e));
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INVITE_SIGNING_KEY = Deno.env.get("INVITE_SIGNING_KEY") || Deno.env.get("WEBHOOK_SIGNING_KEY") || "";
const AI_TRIAL_TOKEN = Deno.env.get("AI_TRIAL_TOKEN") || "";
// Org de origem usada apenas para emitir o invite (created_by/organization_id do
// platform_invites). A conta do lead nasce com organização PRÓPRIA.
const AI_TRIAL_ORIGIN_ORG_ID = Deno.env.get("AI_TRIAL_ORIGIN_ORG_ID") || "";
const INVITE_TTL_MINUTES = 30;
const APP_URL = Deno.env.get("APP_URL") || "https://www.portadocorretor.com.br";

async function hmacSha256(key: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
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

function randomPassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "Aa1!" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const reqMeta = extractRequestMeta(req);
  const clientIp = reqMeta.ip || "unknown";

  const supabaseUrl0 = Deno.env.get("SUPABASE_URL")!;
  const serviceKey0 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auditClient = createClient(supabaseUrl0, serviceKey0);

  // ── 1. Autenticação do token da IA (timing-safe) ──
  const authHeader = req.headers.get("Authorization") || "";
  const presented = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!AI_TRIAL_TOKEN || !presented || !timingSafeEqual(presented, AI_TRIAL_TOKEN)) {
    await auditLog(auditClient, {
      event_type: "ai_trial_unauthorized",
      severity: "warn",
      endpoint: "ai-create-trial",
      decision: "deny",
      reason_code: "invalid_ai_token",
      ip: clientIp,
      user_agent: reqMeta.userAgent,
    });
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const supabaseUrl = supabaseUrl0;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const adminClient = auditClient;

    const body = await req.json().catch(() => ({}));
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const telefone = normalizePhone(typeof body.telefone === "string" ? body.telefone : "");
    const empresa = typeof body.empresa === "string" ? body.empresa.trim() : "";
    const tipo = body.tipo === "corretor_individual" ? "corretor_individual" : "imobiliaria";

    // ── 2. Validação de entrada ──
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "E-mail inválido" }, 422);
    if (!nome) return json({ error: "Nome é obrigatório" }, 422);
    if (telefone && telefone.length < 10) return json({ error: "Telefone inválido" }, 422);
    const companyName = empresa || nome;

    // ── 3. Rate-limit por email e por telefone (além do IP no platform-signup) ──
    const emailLimit = await checkRateLimit(`ai-trial:email:${email}`, 3, 86400);
    if (!emailLimit.allowed) return json({ error: "Limite de tentativas para este e-mail. Tente mais tarde." }, 429);
    if (telefone) {
      const phoneLimit = await checkRateLimit(`ai-trial:phone:${telefone}`, 3, 86400);
      if (!phoneLimit.allowed) return json({ error: "Limite de tentativas para este telefone." }, 429);
    }

    // ── 4. Idempotência: 1 trial por lead ──
    // Procura usuário existente por email (auth) e por telefone (profiles).
    let existingUserId: string | null = null;
    let existingOrgId: string | null = null;
    let existingTrialEnds: string | null = null;

    {
      // Busca por email diretamente no auth admin (sem depender de RPC opcional).
      const { data: list } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
      if (found) existingUserId = found.id;
    }

    if (!existingUserId && telefone) {
      const { data: profByPhone } = await adminClient
        .from("profiles")
        .select("user_id, organization_id")
        .eq("phone", telefone)
        .maybeSingle();
      if (profByPhone?.user_id) {
        existingUserId = profByPhone.user_id as string;
        existingOrgId = (profByPhone.organization_id as string) || null;
      }
    }

    if (existingUserId) {
      // Já existe trial para este lead → não cria outro. Retorna novo magic link.
      if (!existingOrgId) {
        const { data: prof } = await adminClient
          .from("profiles").select("organization_id").eq("user_id", existingUserId).maybeSingle();
        existingOrgId = (prof?.organization_id as string) || null;
      }
      if (existingOrgId) {
        const { data: orgRow } = await adminClient
          .from("organizations").select("trial_ends_at").eq("id", existingOrgId).maybeSingle();
        existingTrialEnds = (orgRow?.trial_ends_at as string) || null;
      }

      const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: `${APP_URL}/dashboard` },
      });
      if (linkErr) return json({ error: "Conta existe, mas falhou ao gerar link de acesso" }, 500);

      await auditLog(adminClient, {
        event_type: "ai_trial_idempotent",
        severity: "info",
        endpoint: "ai-create-trial",
        decision: "allow",
        reason_code: "lead_already_has_trial",
        ip: clientIp,
        metadata: { email_present: true },
      });

      return json({
        ok: true,
        already_existed: true,
        login_url: linkData.properties?.action_link,
        trial_ends_at: existingTrialEnds,
      }, 200);
    }

    // ── 5. Pré-checagem de duplicados (reusa a função do projeto; retorna jsonb) ──
    const { data: dupCheck } = await adminClient.rpc("check_signup_duplicates", {
      p_email: email,
      p_phone: telefone || null,
      p_document: null,
    });
    // Retorno: {} quando não há duplicado; {email|phone|document: "<msg>"} quando há.
    const dup = (dupCheck || {}) as { email?: string; phone?: string; document?: string };
    if (dup.email || dup.phone || dup.document) {
      return json({ error: dup.email || dup.phone || dup.document, already_existed: true }, 409);
    }

    if (!INVITE_SIGNING_KEY) return json({ error: "Configuração de assinatura ausente" }, 500);
    if (!AI_TRIAL_ORIGIN_ORG_ID) return json({ error: "Org de origem dos trials não configurada" }, 500);

    // ── 6. Emite um platform_invites interno (single-use, TTL curto) ──
    const expiresAt = new Date(Date.now() + INVITE_TTL_MINUTES * 60 * 1000).toISOString();
    const { data: invite, error: inviteErr } = await adminClient
      .from("platform_invites")
      .insert({
        created_by: AI_TRIAL_ORIGIN_ORG_ID, // uuid do criador/origem
        organization_id: AI_TRIAL_ORIGIN_ORG_ID,
        name: `AI trial — ${nome}`,
        status: "active",
        expires_at: expiresAt,
        invite_email: email,
      })
      .select()
      .single();
    if (inviteErr || !invite) {
      console.error("[ai-create-trial] invite insert failed:", inviteErr?.message);
      return json({ error: "Falha ao emitir convite interno" }, 500);
    }

    // ── 7. Assina e chama platform-signup server-to-server ──
    const signature = await hmacSha256(INVITE_SIGNING_KEY, `${invite.id}.${email}`);
    const tempPassword = randomPassword();

    const signupResp = await fetch(`${supabaseUrl}/functions/v1/platform-signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        invite_id: invite.id,
        invite_signature: signature,
        email,
        password: tempPassword,
        full_name: nome,
        company_name: companyName,
        phone: telefone || null,
        account_type: tipo,
        attribution: { source: "ai_whatsapp", channel: "n8n" },
      }),
    });

    const signupJson = await signupResp.json().catch(() => ({}));
    if (!signupResp.ok) {
      // Limpa o invite emitido se o signup falhou.
      await adminClient.from("platform_invites").update({ status: "expired" }).eq("id", invite.id);
      return json({ error: signupJson?.error || "Falha ao criar conta trial" }, signupResp.status);
    }

    const orgId = signupJson.organization_id as string | undefined;
    let trialEndsAt: string | null = null;
    if (orgId) {
      const { data: orgRow } = await adminClient
        .from("organizations").select("trial_ends_at").eq("id", orgId).maybeSingle();
      trialEndsAt = (orgRow?.trial_ends_at as string) || null;
    }

    // ── 8. Gera magic link (lead entra sem senha; senha aleatória nunca sai) ──
    const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${APP_URL}/dashboard` },
    });
    if (linkErr) {
      return json({
        ok: true,
        already_existed: false,
        login_url: `${APP_URL}/auth?email=${encodeURIComponent(email)}`,
        trial_ends_at: trialEndsAt,
        note: "Conta criada; magic link indisponível, use o link de login.",
      }, 200);
    }

    await auditLog(adminClient, {
      event_type: "ai_trial_created",
      severity: "info",
      endpoint: "ai-create-trial",
      actor_org_id: orgId,
      decision: "allow",
      reason_code: "trial_created",
      ip: clientIp,
      metadata: { account_type: tipo },
    });

    return json({
      ok: true,
      already_existed: false,
      login_url: linkData.properties?.action_link,
      trial_ends_at: trialEndsAt,
      expires_at: expiresAt,
    }, 201);
  } catch (err) {
    console.error("[ai-create-trial] error:", err instanceof Error ? err.message : String(err));
    return json({ error: "Erro interno do servidor" }, 500);
  }
});
