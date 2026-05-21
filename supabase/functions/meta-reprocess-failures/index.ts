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
 updated_at: now
 })
 .eq("id", failure.id);
 continue;
 }

 try {
 const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-leadgen-webhook`;
 const res = await fetch(webhookUrl, {
 method: "POST",
 headers: {
 "content-type": "application/json",
 "x-meta-reprocess-log-id": failure.id,
 "authorization": `Bearer ${serviceRole}`
 },
 body: JSON.stringify(normalized.payload)
 });

 if (res.ok) {
 await admin
 .from("meta_lead_failures")
 .update({
 status: "retrying",
 attempt_count: (failure.attempt_count || 0) + 1,
 last_attempt_at: now,
 updated_at: now
 })
 .eq("id", failure.id);
 ok++;
 } else {
 const errorText = await res.text();
 await admin
 .from("meta_lead_failures")
 .update({
 status: "failed",
 reason: `webhook returned ${res.status}: ${errorText}`,
 attempt_count: (failure.attempt_count || 0) + 1,
 last_attempt_at: now,
 updated_at: now
 })
 .eq("id", failure.id);
 }
 } catch (err) {
 await admin
 .from("meta_lead_failures")
 .update({
 status: "error",
 reason: `unexpected reprocess error: ${err.message || String(err)}`,
 attempt_count: (failure.attempt_count || 0) + 1,
 last_attempt_at: now,
 updated_at: now
 })
 .eq("id", failure.id);
 }
 }

 return new Response(JSON.stringify({ reprocessed: ok, total: failures.length }), {
 headers: { ...corsHeaders, "content-type": "application/json" },
 });
});

function normalizeMetaReprocessPayload(f: FailureRow) {
 const p = f.payload;
 if (!p) return { ok: false, reason: "payload is null" };

 // If it's already in the Meta structure
 if (p.entry && Array.isArray(p.entry)) {
 return { ok: true, payload: p };
 }

 // If it's a raw Meta entry value (common in some fallback logic)
 if (p.leadgen_id && p.page_id) {
 return {
 ok: true,
 payload: {
 object: "page",
 entry: [{
 id: p.page_id,
 time: Math.floor(Date.now() / 1000),
 changes: [{
 field: "leadgen",
 value: p
 }]
 }]
 }
 };
 }

 // Reconstruct from IDs if payload is incomplete but IDs are present
 if (f.leadgen_id && f.page_id) {
 return {
 ok: true,
 payload: {
 object: "page",
 entry: [{
 id: f.page_id,
 time: Math.floor(Date.now() / 1000),
 changes: [{
 field: "leadgen",
 value: {
 leadgen_id: f.leadgen_id,
 page_id: f.page_id,
 form_id: f.form_id,
 ad_id: p.ad_id || null,
 created_time: p.created_time || Math.floor(Date.now() / 1000)
 }
 }]
 }]
 }
 };
 }

 return { ok: false, reason: "missing required leadgen_id or page_id in payload/record" };
}
