import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => null);
    if (!body) return json({ error: "Body inválido" }, 400);

    const invite_id: string | undefined = body.invite_id;
    const email: string | undefined = body.email?.toString().trim().toLowerCase();
    const password: string | undefined = body.password;
    const full_name: string | undefined = body.full_name?.toString().trim();
    const org_code: string | undefined = body.org_code?.toString().trim();

    if (!invite_id || !email || !password || !full_name || !org_code) {
      return json({ error: "Campos obrigatórios ausentes" }, 400);
    }
    if (password.length < 6) return json({ error: "Senha muito curta" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Email inválido" }, 400);

    // Fetch invite
    const { data: invite, error: inviteErr } = await admin
      .from("organization_invites")
      .select("id, organization_id, role, status, expires_at, email")
      .eq("id", invite_id)
      .maybeSingle();

    if (inviteErr || !invite) return json({ error: "Convite não encontrado" }, 404);
    if (invite.status !== "pending") return json({ error: "Convite já utilizado ou expirado" }, 400);
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return json({ error: "Convite expirado" }, 400);
    }
    if (invite.email && invite.email.toLowerCase().trim() !== email) {
      return json({ error: "Este convite é destinado a outro email" }, 403);
    }

    // Validate org code
    const { data: codeOk, error: codeErr } = await admin.rpc("validate_invite_org_code", {
      p_org_id: invite.organization_id,
      p_code: org_code,
    });
    if (codeErr) {
      console.error("[accept-invite-signup] validate_invite_org_code error:", codeErr.message);
      return json({ error: "Erro ao validar código" }, 500);
    }
    if (!codeOk) return json({ error: "Código da imobiliária incorreto" }, 400);

    // Create user already confirmed
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        account_type: "corretor_individual",
      },
    });

    if (createErr || !created.user) {
      const msg = createErr?.message || "Erro ao criar usuário";
      const lower = msg.toLowerCase();
      if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
        return json({ error: "email_already_registered" }, 409);
      }
      console.error("[accept-invite-signup] createUser error:", msg);
      return json({ error: msg }, 400);
    }

    // Accept the invite (handle_new_user trigger already created the profile)
    const { data: acceptRes, error: acceptErr } = await admin.rpc("accept_organization_invite", {
      p_invite_id: invite.id,
      p_user_id: created.user.id,
      p_user_email: email,
    });

    if (acceptErr) {
      console.error("[accept-invite-signup] accept RPC error:", acceptErr.message);
      // Don't roll back the user — they can sign in and accept manually.
      return json({ error: "Conta criada, mas falha ao vincular ao convite. Faça login e tente novamente." }, 500);
    }

    const result = acceptRes as { success?: boolean; error?: string };
    if (result?.error) {
      return json({ error: result.error, partial: true }, 400);
    }

    return json({ success: true, user_id: created.user.id });
  } catch (err) {
    console.error("[accept-invite-signup] fatal:", (err as Error).message);
    return json({ error: "Erro interno" }, 500);
  }
});
