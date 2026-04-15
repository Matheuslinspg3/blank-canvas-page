/**
 * ticket-chat — Phase 0 Hardened
 *
 * Security: validates that the ticket belongs to the caller's organization.
 * Exception: developer role can access any ticket (explicit escape hatch).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkAiRateLimitRedis } from "../_shared/rate-limiter.ts";
import { resolveAuthContext, requireRole } from "../_shared/auth-helpers.ts";
import { auditLog, extractRequestMeta } from "../_shared/security-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const WEBHOOK_URL = Deno.env.get("N8N_TICKET_WEBHOOK_URL") || "https://n8n.costazul.shop/webhook/lovableportadocorrerora";
const MAX_AI_QUESTIONS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { ticket_id, message } = await req.json();
    if (!ticket_id || !message) {
      return new Response(JSON.stringify({ error: "ticket_id and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Auth: resolve user context via JWT ---
    const { ctx, error: authError } = await resolveAuthContext(req);
    if (authError || !ctx) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = { id: ctx.userId, email: ctx.email || "" };

    // Rate limit: 30 req/hour (Upstash Redis)
    const rateLimited = await checkAiRateLimitRedis(user.id, "ticket-chat", corsHeaders);
    if (rateLimited) return rateLimited;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get ticket info
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets").select("*").eq("id", ticket_id).single();
    if (ticketError || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Org ownership check ---
    // DEVELOPER EXCEPTION: developers can access any ticket for support purposes.
    const isDeveloper = requireRole(ctx, ["developer"]);
    if (!isDeveloper) {
      // Derive ticket's org: prefer ticket.organization_id, fallback to ticket creator's profile
      let ticketOrgId = ticket.organization_id || null;
      if (!ticketOrgId && ticket.user_id) {
        const { data: ticketOwnerProfile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", ticket.user_id)
          .maybeSingle();
        ticketOrgId = ticketOwnerProfile?.organization_id || null;
      }

      if (!ticketOrgId || ticketOrgId !== ctx.organizationId) {
        const reqMeta = extractRequestMeta(req);
        await auditLog({
          event_type: "cross_org_ticket_access",
          severity: "error",
          endpoint: "ticket-chat",
          actor_user_id: ctx.userId,
          actor_org_id: ctx.organizationId || undefined,
          target_type: "ticket",
          target_id: ticket_id,
          decision: "deny",
          reason_code: "cross_org",
          metadata: { ticket_org: ticketOrgId },
          ip: reqMeta.ip,
          user_agent: reqMeta.userAgent,
        });
        console.warn(`[ticket-chat] Cross-org denied: caller_org=${ctx.organizationId} ticket_org=${ticketOrgId} ticket=${ticket_id}`);
        return new Response(JSON.stringify({ error: "Forbidden: ticket belongs to another organization" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Save user message
    await supabase.from("ticket_messages").insert({
      ticket_id, sender_role: "user", sender_id: user.id, content: message,
    });

    // Get conversation history
    const { data: history } = await supabase
      .from("ticket_messages").select("*").eq("ticket_id", ticket_id)
      .order("created_at", { ascending: true }).limit(50);

    const aiMessageCount = (history || []).filter((m: any) => m.sender_role === "ai").length;
    const questionsRemaining = MAX_AI_QUESTIONS - aiMessageCount;
    const isLastQuestion = questionsRemaining <= 1;

    const systemPrompt = buildSystemPrompt(ticket, aiMessageCount, questionsRemaining, isLastQuestion);

    const conversationMessages = (history || []).map((m: any) =>
      `${m.sender_role === "user" ? "Usuário" : "Assistente"}: ${m.content}`
    ).join("\n\n");

    const prompt = `${conversationMessages}\n\nUsuário: ${message}`;

    // Call ai-router
    const authHeader = req.headers.get("Authorization");
    const routerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-router`, {
      method: "POST",
      headers: {
        Authorization: authHeader || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        task_type: "ticket_chat",
        prompt,
        system_prompt: systemPrompt,
        user_id: user.id,
      }),
    });

    const aiResult = await routerResponse.json();
    const aiContent = aiResult.success
      ? (aiResult.text || "Desculpe, não consegui processar sua mensagem.")
      : "Desculpe, não consegui processar sua mensagem. O suporte técnico foi notificado.";

    // Log AI usage
    const { data: userProfile } = await supabase.from("profiles").select("organization_id").eq("user_id", user.id).single();
    await supabase.from("ai_usage_logs").insert({
      organization_id: userProfile?.organization_id || null,
      user_id: user.id,
      provider: aiResult.provider || "ai-router",
      model: aiResult.model || "unknown",
      function_name: "ticket-chat",
      usage_type: "text",
      tokens_input: aiResult.tokens_input || 0,
      tokens_output: aiResult.tokens_output || 0,
      estimated_cost_usd: aiResult.estimated_cost_usd || 0,
      success: aiResult.success || false,
    });

    // Save AI response
    await supabase.from("ticket_messages").insert({
      ticket_id, sender_role: "ai", sender_id: null, content: aiContent,
    });

    // Send webhook after last AI question
    if (isLastQuestion) {
      await handleAnamnesisComplete(supabase, ticket, user, { content: aiContent, provider: aiResult.provider || "ai-router", success: aiResult.success || false }, ticket_id);
    }

    return new Response(JSON.stringify({
      reply: aiContent,
      anamnesis_complete: isLastQuestion,
      questions_remaining: isLastQuestion ? 0 : questionsRemaining - 1,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ticket-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSystemPrompt(ticket: any, aiMessageCount: number, questionsRemaining: number, isLastQuestion: boolean): string {
  const context = `Contexto do ticket:
- Assunto: ${ticket.subject}
- Descrição: ${ticket.description}
- Categoria: ${ticket.category}`;

  if (isLastQuestion) {
    return `Você é o assistente de suporte técnico da plataforma Porta do Corretor.

${context}

Esta é sua ÚLTIMA interação. Você já fez ${aiMessageCount} perguntas de diagnóstico.
Agora DEVE:
1. Agradecer as informações fornecidas
2. Fazer RESUMO TÉCNICO COMPLETO do problema
3. Sugerir possíveis soluções ou workarounds
4. Informar que o diagnóstico será enviado à equipe técnica

REGRAS:
- O nome é "Porta do Corretor", NUNCA "Habitae"
- NÃO invente informações
- Português brasileiro, claro e profissional`;
  }

  return `Você é o assistente de suporte técnico da plataforma Porta do Corretor.

${context}

ANAMNESE TÉCNICA - ${aiMessageCount} pergunta(s) feitas, ${questionsRemaining} restantes.

REGRAS:
- Faça APENAS UMA pergunta por resposta
- Seja direto e específico
- O nome é "Porta do Corretor", NUNCA "Habitae"
- NÃO invente informações
- Português brasileiro, empático e objetivo`;
}

async function handleAnamnesisComplete(
  supabase: any, ticket: any, user: any, aiResult: { content: string; provider: string; success: boolean }, ticket_id: string
) {
  const { data: fullHistory } = await supabase
    .from("ticket_messages").select("sender_role, content, created_at")
    .eq("ticket_id", ticket_id).order("created_at", { ascending: true });

  const { data: profile } = await supabase.from("profiles").select("full_name, organization_id").eq("user_id", user.id).single();

  let orgName = "Desconhecida";
  if (profile?.organization_id) {
    const { data: org } = await supabase.from("organizations").select("name").eq("id", profile.organization_id).single();
    orgName = org?.name || orgName;
  }

  const conversationLog = (fullHistory || []).map((m: any) => ({
    role: m.sender_role, content: m.content, timestamp: m.created_at,
  }));

  const webhookPayload = {
    type: "ticket_anamnesis_complete",
    ticket_id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    status: ticket.status,
    created_at: ticket.created_at,
    source: "porta_do_corretor",
    project_id: "32f18075-f5bc-4619-801e-39da715b91b0",
    user_id: user.id,
    user_name: profile?.full_name || "Desconhecido",
    user_email: user.email || "",
    organization_name: orgName,
    ai_provider: aiResult.provider,
    ai_success: aiResult.success,
    ai_conclusion: aiResult.content,
    conversation_history: conversationLog,
    total_messages: conversationLog.length,
  };

  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload),
  }).catch((err) => console.error("Webhook error:", err));

  await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", ticket_id);
}
