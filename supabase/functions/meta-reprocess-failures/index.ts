import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FailureRow = {
  id: string;
  organization_id: string | null;
  leadgen_id: string | null;
  page_id: string | null;
  form_id: string | null;
  payload: Record<string, unknown> | null;
  attempt_count: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const auth = req.headers.get("authorization") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!auth.startsWith("Bearer ") || auth.slice(7) !== serviceRole) {
    return new Response("unauthorized", { status: 401 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceRole);
  const { data: failures } = await admin
    .from("meta_lead_failures")
    .select("id,organization_id,leadgen_id,page_id,form_id,payload,attempt_count")
    .in("status", ["pending", "retrying", "failed"])
    .limit(50);

  if (!failures?.length) {
    return new Response(JSON.stringify({ reprocessed: 0, total: 0 }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  let ok = 0;
  for (const failure of failures as FailureRow[]) {
    const now = new Date().toISOString();

    const normalized = normalizeMetaReprocessPayload(failure);
    if (!normalized.ok) {
      await admin
        .from("meta_lead_failures")
        .update({
          status: "failed",
          reason: `reprocess normalization failed: ${normalized.reason}`,
          attempt_count: (failure.attempt_count || 0) + 1,
          last_attempt_at: now,
          updated_at: now,
        })
        .eq("id", failure.id);
      continue;
    }

    console.log(`Meta reprocess attempt: failure_id=${failure.id}, leadgen_id=${normalized.payload.entry[0].changes[0].value.leadgen_id}`);

    const { data, error } = await admin.functions.invoke("meta-leadgen-webhook", {
      body: normalized.payload,
      headers: {
        authorization: `Bearer ${serviceRole}`,
        "x-meta-reprocess-log-id": failure.id,
      },
    });

    const statusCode = typeof (data as any)?.status === "number" ? (data as any).status : null;
    const webhookAccepted = !error && (statusCode === null || statusCode === 200);

    await admin
      .from("meta_lead_failures")
      .update({
        status: webhookAccepted ? "resolved" : "retrying",
        reason: webhookAccepted ? "reprocessed via meta-leadgen-webhook" : `reprocess webhook invoke failed${statusCode ? ` (status=${statusCode})` : ""}`,
        attempt_count: (failure.attempt_count || 0) + 1,
        last_attempt_at: now,
        resolved_at: webhookAccepted ? now : null,
        updated_at: now,
      })
      .eq("id", failure.id);

    if (webhookAccepted) ok++;
  }

  return new Response(JSON.stringify({ reprocessed: ok, total: failures.length }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});

function normalizeMetaReprocessPayload(failure: FailureRow):
  | { ok: true; payload: { entry: Array<{ changes: Array<{ field: "leadgen"; value: Record<string, unknown> }> }> } }
  | { ok: false; reason: string } {
  const raw = (failure.payload || {}) as Record<string, unknown>;

  if (Array.isArray((raw as any).entry)) {
    const entries = (raw as any).entry;
    const firstChange = entries?.[0]?.changes?.[0];
    if (firstChange?.field === "leadgen" && firstChange?.value?.leadgen_id && firstChange?.value?.page_id) {
      return { ok: true, payload: raw as any };
    }
  }

  const inferredLeadgenId = (typeof raw.leadgen_id === "string" && raw.leadgen_id) || failure.leadgen_id;
  const inferredPageId = (typeof raw.page_id === "string" && raw.page_id) || failure.page_id;
  const inferredFormId = (typeof raw.form_id === "string" && raw.form_id) || failure.form_id;
  const inferredAdId = typeof raw.ad_id === "string" ? raw.ad_id : null;

  if (!inferredLeadgenId || !inferredPageId) {
    return { ok: false, reason: "missing leadgen_id or page_id" };
  }

  return {
    ok: true,
    payload: {
      entry: [
        {
          changes: [
            {
              field: "leadgen",
              value: {
                leadgen_id: inferredLeadgenId,
                page_id: inferredPageId,
                form_id: inferredFormId,
                ad_id: inferredAdId,
              },
            },
          ],
        },
      ],
    },
  };
}
