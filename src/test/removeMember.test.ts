/**
 * Test the broker-removal contract end-to-end at the integration layer
 * by simulating the edge function's side-effects against an in-memory
 * fake Supabase client and verifying:
 *
 *   1) `useBrokers` (the hook that powers every "assign to broker" select)
 *      filters by the caller's organization_id, so a removed broker —
 *      whose `organization_id` was nulled and `removed_at` stamped —
 *      no longer appears in the list.
 *
 *   2) The remove_member flow, when applied, leaves no active assignments
 *      pointing at the removed broker across leads / tasks / appointments /
 *      inbox_assignments / contracts / commissions.
 *
 *   3) The removed broker's user_roles are deleted (no panel access).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ---------- in-memory fake DB ----------
type Row = Record<string, any>;
const db: Record<string, Row[]> = {};

function table(name: string) {
  if (!db[name]) db[name] = [];
  return db[name];
}

// profiles_public is a view: project from `profiles` on read.
function readSource(name: string): Row[] {
  if (name === "profiles_public") {
    return table("profiles")
      .filter((p) => p.removed_at === null && p.organization_id !== null)
      .map((p) => ({
        id: p.id, user_id: p.user_id, full_name: p.full_name,
        avatar_url: p.avatar_url ?? null, organization_id: p.organization_id,
      }));
  }
  return table(name);
}

function resetDb() {
  for (const k of Object.keys(db)) delete db[k];
}

// Minimal supabase-js-like query builder backed by `db`
function from(tableName: string) {
  // Re-read on each terminal call so views reflect latest mutations.
  const getRows = () => [...readSource(tableName)];
  const filters: Array<(r: Row) => boolean> = [];
  const builder: any = {
    select: (_cols?: string) => builder,
    eq: (col: string, val: any) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    order: () => builder,
    is: (col: string, val: any) => {
      filters.push((r) => r[col] === val);
      return builder;
    },
    in: (col: string, vals: any[]) => {
      filters.push((r) => vals.includes(r[col]));
      return builder;
    },
    update: (patch: Row) => {
      const sub: any = {
        eq: (col: string, val: any) => {
          filters.push((r) => r[col] === val);
          return sub;
        },
        then: (resolve: any) => {
          const target = table(tableName);
          for (const r of target) {
            if (filters.every((f) => f(r))) Object.assign(r, patch);
          }
          resolve({ data: null, error: null });
        },
      };
      return sub;
    },
    delete: () => {
      const sub: any = {
        eq: (col: string, val: any) => {
          filters.push((r) => r[col] === val);
          return sub;
        },
        then: (resolve: any) => {
          db[tableName] = table(tableName).filter(
            (r) => !filters.every((f) => f(r)),
          );
          resolve({ data: null, error: null });
        },
      };
      return sub;
    },
    then: (resolve: any) => {
      const out = rows.filter((r) => filters.every((f) => f(r)));
      resolve({ data: out, error: null });
    },
  };
  return builder;
}

// ---------- mock @/integrations/supabase/client ----------
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from },
}));

// ---------- mock AuthContext ----------
const mockAuth = { user: { id: "admin-uid" }, profile: { organization_id: "org-1" } };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuth,
}));

// ---------- helpers ----------
function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

/**
 * Mirrors the exact side-effects of the manage-member edge function's
 * `remove_member` action. Kept in sync manually — if the edge function
 * adds a new table to clean, mirror it here.
 */
async function simulateRemoveMember(orgId: string, targetId: string, callerId: string) {
  // 1. Detach profile
  await from("profiles")
    .update({ organization_id: null, removed_at: new Date().toISOString(), custom_role_id: null })
    .eq("user_id", targetId);
  // 2. Drop roles
  await from("user_roles").delete().eq("user_id", targetId);
  // 3. Unassign org-scoped resources
  await from("leads").update({ broker_id: null })
    .eq("broker_id", targetId).eq("organization_id", orgId);
  await from("tasks").update({ assigned_to: null })
    .eq("assigned_to", targetId).eq("organization_id", orgId);
  await from("appointments").update({ assigned_to: null })
    .eq("assigned_to", targetId).eq("organization_id", orgId);
  // 4. inbox_assignments.assigned_to is NOT NULL -> delete
  await from("inbox_assignments").delete()
    .eq("assigned_to", targetId).eq("organization_id", orgId);
  // 5. contracts can be nulled
  await from("contracts").update({ broker_id: null })
    .eq("broker_id", targetId).eq("organization_id", orgId);
  // 6. commissions are reassigned to caller (financial history)
  await from("commissions").update({ broker_id: callerId })
    .eq("broker_id", targetId).eq("organization_id", orgId);
}

// ---------- tests ----------
describe("broker removal contract", () => {
  beforeEach(() => {
    resetDb();
    // Seed: 1 admin + 1 broker in same org, with assignments
    table("profiles").push(
      { user_id: "admin-uid", id: "admin-pid", full_name: "Admin",
        organization_id: "org-1", removed_at: null, custom_role_id: null },
      { user_id: "broker-uid", id: "broker-pid", full_name: "Broker To Remove",
        organization_id: "org-1", removed_at: null, custom_role_id: null },
    );
    // profiles_public mirrors profiles but filters removed_at IS NULL + org_id NOT NULL
    Object.defineProperty(db, "profiles_public", {
      get() {
        return table("profiles").filter(
          (p) => p.removed_at === null && p.organization_id !== null,
        );
      },
      configurable: true,
    });
    table("user_roles").push(
      { user_id: "admin-uid", role: "admin" },
      { user_id: "broker-uid", role: "corretor" },
    );
    table("leads").push({
      id: "lead-1", organization_id: "org-1", broker_id: "broker-uid", is_active: true,
    });
    table("tasks").push({
      id: "task-1", organization_id: "org-1", assigned_to: "broker-uid",
    });
    table("appointments").push({
      id: "appt-1", organization_id: "org-1", assigned_to: "broker-uid",
    });
    table("inbox_assignments").push({
      id: "inbox-1", organization_id: "org-1", assigned_to: "broker-uid",
    });
    table("contracts").push({
      id: "contract-1", organization_id: "org-1", broker_id: "broker-uid",
    });
    table("commissions").push({
      id: "comm-1", organization_id: "org-1", broker_id: "broker-uid", amount: 100,
    });
  });

  it("useBrokers lists the broker BEFORE removal", async () => {
    const { useBrokers } = await import("@/hooks/useBrokers");
    const { result } = renderHook(() => useBrokers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const ids = result.current.brokers.map((b) => b.user_id);
    expect(ids).toContain("broker-uid");
  });

  it("useBrokers HIDES the broker AFTER removal (profiles_public excludes removed)", async () => {
    await simulateRemoveMember("org-1", "broker-uid", "admin-uid");

    const { useBrokers } = await import("@/hooks/useBrokers");
    const { result } = renderHook(() => useBrokers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const ids = result.current.brokers.map((b) => b.user_id);
    expect(ids).not.toContain("broker-uid");
    expect(ids).toContain("admin-uid"); // admin still visible
  });

  it("useBrokers scopes by organization_id (does not leak across orgs)", async () => {
    // Add a broker in another org
    table("profiles").push({
      user_id: "other-org-broker", id: "x", full_name: "Other Org",
      organization_id: "org-2", removed_at: null, custom_role_id: null,
    });

    const { useBrokers } = await import("@/hooks/useBrokers");
    const { result } = renderHook(() => useBrokers(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const ids = result.current.brokers.map((b) => b.user_id);
    expect(ids).not.toContain("other-org-broker");
  });

  describe("after remove_member runs, the broker has no active linkage", () => {
    beforeEach(async () => {
      await simulateRemoveMember("org-1", "broker-uid", "admin-uid");
    });

    it("profile is detached and stamped removed_at", () => {
      const p = table("profiles").find((r) => r.user_id === "broker-uid")!;
      expect(p.organization_id).toBeNull();
      expect(p.removed_at).toBeTruthy();
    });

    it("loses ALL roles (no panel access)", () => {
      const roles = table("user_roles").filter((r) => r.user_id === "broker-uid");
      expect(roles).toHaveLength(0);
    });

    it("leads are unassigned", () => {
      const stillAssigned = table("leads").filter((l) => l.broker_id === "broker-uid");
      expect(stillAssigned).toHaveLength(0);
    });

    it("tasks are unassigned", () => {
      expect(table("tasks").filter((t) => t.assigned_to === "broker-uid")).toHaveLength(0);
    });

    it("appointments are unassigned", () => {
      expect(table("appointments").filter((a) => a.assigned_to === "broker-uid")).toHaveLength(0);
    });

    it("inbox_assignments are deleted (NOT NULL column)", () => {
      expect(table("inbox_assignments").filter((i) => i.assigned_to === "broker-uid"))
        .toHaveLength(0);
    });

    it("contracts are unassigned", () => {
      expect(table("contracts").filter((c) => c.broker_id === "broker-uid")).toHaveLength(0);
    });

    it("commissions are preserved but reassigned to caller (financial history)", () => {
      const orig = table("commissions").find((c) => c.id === "comm-1")!;
      expect(orig.broker_id).toBe("admin-uid");
      expect(orig.amount).toBe(100);
    });
  });
});
