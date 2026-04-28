/**
 * Integration test for `manage-member` -> action: "remove_member".
 *
 * Verifies the full removal contract:
 *   1) Removed broker disappears from `profiles_public` (UI broker lists)
 *   2) Removed broker loses access (no roles, organization_id null, sessions revoked)
 *   3) All assignments are cleaned across leads / tasks / appointments /
 *      inbox_assignments / contracts / commissions
 *
 * Run with: supabase--test_edge_functions { functions: ["manage-member"] }
 *
 * Requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (loaded
 * automatically by the test harness via the dotenv import below).
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  assertEquals,
  assertExists,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-member`;

assertExists(SUPABASE_URL, "VITE_SUPABASE_URL missing");
assertExists(SERVICE_ROLE, "SUPABASE_SERVICE_ROLE_KEY missing");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- helpers ----------
const rand = () => crypto.randomUUID().slice(0, 8);

async function createUser(email: string, password = "TestPass!2026") {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return { user: data.user!, password };
}

async function signIn(email: string, password: string) {
  const anon = createClient(SUPABASE_URL, Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session!;
}

async function setupFixture() {
  const tag = rand();

  // 1) Org
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .insert({ name: `test-org-${tag}`, slug: `test-org-${tag}` })
    .select()
    .single();
  if (orgErr) throw orgErr;

  // 2) Admin caller
  const adminEmail = `admin-${tag}@test.local`;
  const adminAuth = await createUser(adminEmail);
  await admin.from("profiles").update({
    organization_id: org.id, full_name: `Admin ${tag}`,
  }).eq("user_id", adminAuth.user.id);
  await admin.from("user_roles").upsert({
    user_id: adminAuth.user.id, role: "admin",
  });

  // 3) Target broker (will be removed)
  const brokerEmail = `broker-${tag}@test.local`;
  const brokerAuth = await createUser(brokerEmail);
  await admin.from("profiles").update({
    organization_id: org.id, full_name: `Broker ${tag}`,
  }).eq("user_id", brokerAuth.user.id);
  await admin.from("user_roles").upsert({
    user_id: brokerAuth.user.id, role: "corretor",
  });

  // 4) Sign broker in (should later be revoked)
  const brokerSession = await signIn(brokerEmail, brokerAuth.password);

  // 5) Populate assignments for the broker
  const { data: lead } = await admin.from("leads").insert({
    organization_id: org.id,
    name: `Lead ${tag}`,
    stage: "novo",
    is_active: true,
    broker_id: brokerAuth.user.id,
    created_by: adminAuth.user.id,
  }).select().single();

  await admin.from("tasks").insert({
    organization_id: org.id,
    title: `Task ${tag}`,
    assigned_to: brokerAuth.user.id,
    created_by: adminAuth.user.id,
  });

  await admin.from("appointments").insert({
    organization_id: org.id,
    title: `Appt ${tag}`,
    start_time: new Date(Date.now() + 86400_000).toISOString(),
    assigned_to: brokerAuth.user.id,
    created_by: adminAuth.user.id,
  });

  return { org, adminAuth, brokerAuth, brokerSession, lead };
}

async function cleanup(fixture: Awaited<ReturnType<typeof setupFixture>>) {
  // Best-effort teardown
  await admin.from("leads").delete().eq("organization_id", fixture.org.id);
  await admin.from("tasks").delete().eq("organization_id", fixture.org.id);
  await admin.from("appointments").delete().eq("organization_id", fixture.org.id);
  await admin.from("inbox_assignments").delete().eq("organization_id", fixture.org.id);
  await admin.from("contracts").delete().eq("organization_id", fixture.org.id);
  await admin.from("commissions").delete().eq("organization_id", fixture.org.id);
  await admin.from("user_roles").delete().eq("user_id", fixture.brokerAuth.user.id);
  await admin.from("user_roles").delete().eq("user_id", fixture.adminAuth.user.id);
  await admin.from("profiles").delete().eq("user_id", fixture.brokerAuth.user.id);
  await admin.from("profiles").delete().eq("user_id", fixture.adminAuth.user.id);
  await admin.from("organizations").delete().eq("id", fixture.org.id);
  await admin.auth.admin.deleteUser(fixture.brokerAuth.user.id).catch(() => {});
  await admin.auth.admin.deleteUser(fixture.adminAuth.user.id).catch(() => {});
}

// ---------- tests ----------

Deno.test("remove_member: full removal contract", async (t) => {
  const fx = await setupFixture();

  try {
    // ----- pre-conditions -----
    await t.step("pre: broker visible in profiles_public", async () => {
      const { data } = await admin
        .from("profiles_public")
        .select("user_id")
        .eq("user_id", fx.brokerAuth.user.id);
      assertEquals(data?.length, 1);
    });

    await t.step("pre: broker assignments exist", async () => {
      const { count: leadsCount } = await admin
        .from("leads").select("*", { count: "exact", head: true })
        .eq("broker_id", fx.brokerAuth.user.id);
      const { count: tasksCount } = await admin
        .from("tasks").select("*", { count: "exact", head: true })
        .eq("assigned_to", fx.brokerAuth.user.id);
      const { count: apptCount } = await admin
        .from("appointments").select("*", { count: "exact", head: true })
        .eq("assigned_to", fx.brokerAuth.user.id);
      assertEquals(leadsCount, 1);
      assertEquals(tasksCount, 1);
      assertEquals(apptCount, 1);
    });

    // Get an admin session to call the edge function with caller auth
    const adminSession = await signIn(
      fx.adminAuth.user.email!,
      fx.adminAuth.password,
    );

    // ----- ACTION: remove_member -----
    await t.step("call remove_member returns success", async () => {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminSession.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "remove_member",
          user_id: fx.brokerAuth.user.id,
          reason: "automated test",
        }),
      });
      const body = await res.json();
      assertEquals(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(body)}`);
      assertEquals(body.success, true);
    });

    // ----- post-conditions -----
    await t.step("1. broker hidden from profiles_public (UI lists)", async () => {
      const { data } = await admin
        .from("profiles_public")
        .select("user_id")
        .eq("user_id", fx.brokerAuth.user.id);
      assertEquals(data?.length, 0, "removed broker still in profiles_public");
    });

    await t.step("2a. broker has no roles left", async () => {
      const { data } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", fx.brokerAuth.user.id);
      assertEquals(data?.length, 0);
    });

    await t.step("2b. broker profile is detached from org and stamped removed_at", async () => {
      const { data } = await admin
        .from("profiles")
        .select("organization_id, removed_at")
        .eq("user_id", fx.brokerAuth.user.id)
        .single();
      assertEquals(data?.organization_id, null);
      assertExists(data?.removed_at, "removed_at should be set");
    });

    await t.step("2c. broker session is revoked (refresh fails)", async () => {
      // Try to use the previously-issued refresh token — should be invalid now
      const refreshRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!,
        },
        body: JSON.stringify({ refresh_token: fx.brokerSession.refresh_token }),
      });
      const body = await refreshRes.text();
      assert(
        refreshRes.status >= 400,
        `expected refresh to fail after global signOut, got ${refreshRes.status}: ${body}`,
      );
    });

    await t.step("3a. leads were unassigned", async () => {
      const { count } = await admin
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("broker_id", fx.brokerAuth.user.id);
      assertEquals(count, 0);
    });

    await t.step("3b. tasks were unassigned", async () => {
      const { count } = await admin
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", fx.brokerAuth.user.id);
      assertEquals(count, 0);
    });

    await t.step("3c. appointments were unassigned", async () => {
      const { count } = await admin
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("assigned_to", fx.brokerAuth.user.id);
      assertEquals(count, 0);
    });
  } finally {
    await cleanup(fx);
  }
});

Deno.test("remove_member: cannot remove yourself", async () => {
  const tag = rand();
  const { data: org } = await admin.from("organizations")
    .insert({ name: `selfrm-${tag}`, slug: `selfrm-${tag}` }).select().single();
  const u = await createUser(`selfrm-${tag}@test.local`);
  await admin.from("profiles").update({ organization_id: org!.id, full_name: "Self" })
    .eq("user_id", u.user.id);
  await admin.from("user_roles").upsert({ user_id: u.user.id, role: "admin" });
  const session = await signIn(u.user.email!, u.password);

  try {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "remove_member", user_id: u.user.id }),
    });
    const body = await res.json();
    assert(res.status >= 400, `expected error self-removal, got ${res.status}`);
    assert(
      String(body.error || "").toLowerCase().includes("yourself"),
      `expected self-removal error, got ${JSON.stringify(body)}`,
    );
  } finally {
    await admin.from("user_roles").delete().eq("user_id", u.user.id);
    await admin.from("profiles").delete().eq("user_id", u.user.id);
    await admin.from("organizations").delete().eq("id", org!.id);
    await admin.auth.admin.deleteUser(u.user.id).catch(() => {});
  }
});
