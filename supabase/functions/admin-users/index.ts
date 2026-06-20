import { createClient } from "npm:@supabase/supabase-js@2";

// AH-05: CORS allowlist
const ALLOWED_ORIGINS = (Deno.env.get("APP_ALLOWED_ORIGINS") || "").split(",").map(s => s.trim()).filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("No auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller via getClaims (more reliable than getUser)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await (userClient.auth as any).getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) throw new Error("Unauthorized");
    const user = { id: claimsData.claims.sub as string };

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Check if caller has developer role
    const { data: devRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "developer")
      .maybeSingle();

    if (!devRole) throw new Error("Forbidden: developer role required");

    if (req.method === "GET") {
      // List all users with emails
      const { data: { users }, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      // Fetch payment attempts for all users
      const { data: attempts } = await adminClient
        .from("payment_attempts")
        .select("*")
        .order("created_at", { ascending: false });

      const simplifiedUsers = users.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        user_metadata: u.user_metadata,
        payment_attempts: attempts?.filter(a => a.user_id === u.id) || [],
      }));

      return new Response(JSON.stringify(simplifiedUsers), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

<<<<<<< Updated upstream
    if (req.method === "POST") {
      // Cria uma conta já com e-mail confirmado (Opção B): onboarding sem
      // fricção para demo/venda. Restrito a developer (checado acima) e auditado.
=======
<<<<<<< Updated upstream
=======
    if (req.method === "POST") {
      // Cria uma conta completa já com e-mail confirmado (Opção B): onboarding
      // sem fricção para demo/venda. Restrito a developer (checado acima) e
      // auditado. A organização, profile, role e subscription são criados pelo
      // trigger handle_new_user a partir do user_metadata (mesma lógica do
      // signup normal) — não duplicamos essa lógica aqui.
>>>>>>> Stashed changes
      const body = await req.json();
      const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
      const reason = typeof body.reason === "string" ? body.reason.trim() : "";
<<<<<<< Updated upstream
=======
      const companyName = typeof body.company_name === "string" ? body.company_name.trim() : "";
      const phone = typeof body.phone === "string" ? body.phone.trim() : "";
      const documentNum = typeof body.document === "string" ? body.document.trim() : "";
      const accountType = body.account_type === "corretor_individual" ? "corretor_individual" : "imobiliaria";
      const selectedPlan = typeof body.selected_plan === "string" ? body.selected_plan : "starter";
      // subscriptionMode: "trial" (respeita trial do plano) ou "active" (cortesia, sem cobrança)
      const subscriptionMode = body.subscription_mode === "active" ? "active" : "trial";

      const ALLOWED_PLANS = ["starter", "essencial", "business"];
      if (!ALLOWED_PLANS.includes(selectedPlan)) throw new Error("Plano inválido");
>>>>>>> Stashed changes

      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
      if (!emailOk) throw new Error("E-mail inválido");
      if (password.length < 6) throw new Error("Password must be at least 6 characters");
<<<<<<< Updated upstream
=======
      if (!fullName) throw new Error("Nome completo é obrigatório");
      if (!companyName) throw new Error("Nome da empresa/corretor é obrigatório");
>>>>>>> Stashed changes

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email: rawEmail,
        password,
        email_confirm: true,
<<<<<<< Updated upstream
        user_metadata: fullName ? { full_name: fullName } : {},
      });
      if (createErr) {
        // Mensagem amigável para e-mail duplicado.
=======
        // O trigger handle_new_user lê estes campos para montar org+profile+role+subscription.
        user_metadata: {
          full_name: fullName,
          account_type: accountType,
          company_name: companyName,
          phone: phone || undefined,
          document: documentNum || undefined,
          selected_plan: selectedPlan,
        },
      });
      if (createErr) {
>>>>>>> Stashed changes
        if (/already.*registered|already.*exists|duplicate/i.test(createErr.message)) {
          throw new Error("Já existe uma conta com este e-mail");
        }
        throw createErr;
      }

<<<<<<< Updated upstream
      // Auditoria (best-effort: não derruba a criação se o log falhar).
      const newUserId = created.user?.id;
      if (newUserId) {
=======
      const newUserId = created.user?.id;

      // Descobre a organização recém-criada pelo trigger (via profile do usuário).
      let orgId: string | null = null;
      if (newUserId) {
        // Pequena espera: o trigger roda na mesma transação do insert em auth.users,
        // então o profile já deve existir; mas tentamos com retry leve por robustez.
        for (let i = 0; i < 3 && !orgId; i++) {
          const { data: prof } = await adminClient
            .from("profiles").select("organization_id").eq("user_id", newUserId).maybeSingle();
          orgId = prof?.organization_id ?? null;
          if (!orgId) await new Promise((r) => setTimeout(r, 250));
        }
      }

      // Se o developer escolheu "active" (cortesia), promove a subscription de trial→active
      // e zera o trial_end. Caso contrário, mantém o comportamento padrão do trigger.
      let subscriptionApplied = subscriptionMode;
      if (orgId && subscriptionMode === "active") {
        const { error: subErr } = await adminClient
          .from("subscriptions")
          .update({ status: "active", trial_end: null })
          .eq("organization_id", orgId);
        if (subErr) {
          console.error("[admin-users] subscription activate failed:", subErr.message);
          subscriptionApplied = "trial"; // não conseguiu promover; ficou no padrão
        }
        // Alinha as datas de trial da própria organização.
        await adminClient.from("organizations").update({ trial_ends_at: null }).eq("id", orgId);
      }

      // Auditoria (best-effort).
      if (newUserId) {
        const auditReason = [reason, `tipo=${accountType}`, `plano=${selectedPlan}`, `assinatura=${subscriptionApplied}`]
          .filter(Boolean).join(" | ");
>>>>>>> Stashed changes
        const { error: auditErr } = await adminClient.from("admin_created_accounts").insert({
          created_user_id: newUserId,
          created_user_email: rawEmail,
          created_by: user.id,
<<<<<<< Updated upstream
          reason: reason || null,
=======
          reason: auditReason,
>>>>>>> Stashed changes
        });
        if (auditErr) console.error("[admin-users] audit insert failed:", auditErr.message);
      }

<<<<<<< Updated upstream
      return new Response(JSON.stringify({ success: true, user_id: newUserId, email: rawEmail }), {
=======
      return new Response(JSON.stringify({
        success: true,
        user_id: newUserId,
        email: rawEmail,
        organization_id: orgId,
        account_type: accountType,
        plan: selectedPlan,
        subscription: subscriptionApplied,
      }), {
>>>>>>> Stashed changes
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
>>>>>>> Stashed changes
    if (req.method === "PATCH") {
      const { user_id: targetUserId, new_password } = await req.json();
      if (!targetUserId || !new_password) throw new Error("user_id and new_password required");
      if (new_password.length < 6) throw new Error("Password must be at least 6 characters");
      const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, { password: new_password });
      if (updateError) throw updateError;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "DELETE") {
      const { user_id } = await req.json();
      if (!user_id) throw new Error("user_id required");
      if (user_id === user.id) throw new Error("Cannot delete yourself");

      // Nullify all FK references to this user across tables
      await Promise.all([
        adminClient.from("user_roles").delete().eq("user_id", user_id),
        adminClient.from("profiles").delete().eq("user_id", user_id),
        adminClient.from("organizations").update({ created_by: null }).eq("created_by", user_id),
        adminClient.from("organization_invites").delete().eq("invited_by", user_id),
        adminClient.from("properties").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("properties").update({ captador_id: null } as any).eq("captador_id", user_id),
        adminClient.from("leads").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("leads").update({ broker_id: null } as any).eq("broker_id", user_id),
        adminClient.from("lead_interactions").delete().eq("created_by", user_id),
        adminClient.from("contracts").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("contracts").update({ broker_id: null } as any).eq("broker_id", user_id),
        adminClient.from("contract_documents").delete().eq("uploaded_by", user_id),
        adminClient.from("invoices").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("commissions").update({ broker_id: null } as any).eq("broker_id", user_id),
        adminClient.from("appointments").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("appointments").update({ assigned_to: null }).eq("assigned_to", user_id),
        adminClient.from("tasks").update({ created_by: null } as any).eq("created_by", user_id),
        adminClient.from("tasks").update({ assigned_to: null } as any).eq("assigned_to", user_id),
      ]);

      const { error } = await adminClient.auth.admin.deleteUser(user_id);
      if (error) throw new Error(`Delete user failed: ${error.message}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Forbidden") ? 403 : msg.includes("Unauthorized") ? 401 : 400;
    // AH-07: Don't leak internal error details
    const safeMsg = msg.includes("Forbidden") ? "Forbidden" 
      : msg.includes("Unauthorized") ? "Unauthorized"
      : msg.includes("No auth") ? "Unauthorized"
      : "Erro interno";
    console.error("[admin-users] Error:", msg);
    return new Response(JSON.stringify({ error: safeMsg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
