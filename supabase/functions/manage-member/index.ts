/**
 * manage-member — Phase 1 Hardened
 *
 * Centralized endpoint for team member management:
 *  - get_member_stats: list team members with activity stats
 *  - remove_member: remove a member from the organization
 *  - change_role: change a member's role (server-side permission matrix)
 *
 * All role mutations go through this endpoint. Frontend no longer writes
 * directly to user_roles.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { auditLog, extractRequestMeta } from "../_shared/security-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_ROLES = ["admin", "sub_admin", "corretor", "assistente", "developer", "leader"] as const;
type AppRole = typeof VALID_ROLES[number];

/**
 * Server-side permission matrix for role assignment.
 * Key = caller's highest role, Value = roles they can assign.
 */
const ROLE_ASSIGNMENT_MATRIX: Record<string, AppRole[]> = {
  developer: ["admin", "sub_admin", "corretor", "assistente", "leader", "developer"],
  admin: ["sub_admin", "corretor", "assistente"],
  sub_admin: ["corretor", "assistente"],
  leader: [], // read-only in Phase 1
  corretor: [],
  assistente: [],
};

function getHighestRole(roles: string[]): string {
  const hierarchy = ["assistente", "corretor", "leader", "sub_admin", "admin", "developer"];
  let highest = "corretor";
  for (const role of roles) {
    if (hierarchy.indexOf(role) > hierarchy.indexOf(highest)) {
      highest = role;
    }
  }
  return highest;
}

function canAssignRole(callerRoles: string[], targetNewRole: string): boolean {
  const highest = getHighestRole(callerRoles);
  const allowed = ROLE_ASSIGNMENT_MATRIX[highest] || [];
  return allowed.includes(targetNewRole as AppRole);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const reqMeta = extractRequestMeta(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");
    const callerId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get caller's profile and roles
    const [profileRes, rolesRes] = await Promise.all([
      adminClient.from("profiles").select("organization_id").eq("user_id", callerId).single(),
      adminClient.from("user_roles").select("role").eq("user_id", callerId),
    ]);

    const callerProfile = profileRes.data;
    if (!callerProfile?.organization_id) throw new Error("No organization");

    const callerRoleList = (rolesRes.data || []).map((r: any) => r.role);
    const isCallerAdmin = callerRoleList.some((r: string) =>
      ["admin", "sub_admin", "developer", "leader"].includes(r)
    );
    if (!isCallerAdmin) throw new Error("Forbidden");

    const body = await req.json();
    const { action } = body;

    // ═══════════════════════════════════════════════════════
    // ACTION: change_role
    // ═══════════════════════════════════════════════════════
    if (action === "change_role") {
      const { user_id: targetId, new_role: newRole, reason } = body;

      if (!targetId || !newRole) {
        return new Response(JSON.stringify({ error: "user_id and new_role are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate role enum
      if (!VALID_ROLES.includes(newRole as AppRole)) {
        return new Response(JSON.stringify({ error: `Invalid role: ${newRole}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Cannot change own role
      if (targetId === callerId) {
        await auditLog({
          event_type: "role_change",
          severity: "warn",
          endpoint: "manage-member",
          actor_user_id: callerId,
          actor_org_id: callerProfile.organization_id,
          target_type: "user",
          target_id: targetId,
          decision: "deny",
          reason_code: "self_modification",
          metadata: { new_role: newRole },
          ip: reqMeta.ip,
          user_agent: reqMeta.userAgent,
        });
        return new Response(JSON.stringify({ error: "Cannot change your own role" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check target is in same org
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("organization_id, full_name")
        .eq("user_id", targetId)
        .single();

      if (!targetProfile || targetProfile.organization_id !== callerProfile.organization_id) {
        await auditLog({
          event_type: "role_change",
          severity: "error",
          endpoint: "manage-member",
          actor_user_id: callerId,
          actor_org_id: callerProfile.organization_id,
          target_type: "user",
          target_id: targetId,
          decision: "deny",
          reason_code: "cross_org",
          ip: reqMeta.ip,
          user_agent: reqMeta.userAgent,
        });
        return new Response(JSON.stringify({ error: "User not in your organization" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get target's current roles
      const { data: targetRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", targetId);
      const targetRoleList = (targetRoles || []).map((r: any) => r.role);
      const oldRole = targetRoleList.length > 0 ? getHighestRole(targetRoleList) : "corretor";

      // Permission matrix check
      if (!canAssignRole(callerRoleList, newRole)) {
        await auditLog({
          event_type: "role_change",
          severity: "warn",
          endpoint: "manage-member",
          actor_user_id: callerId,
          actor_org_id: callerProfile.organization_id,
          target_type: "user",
          target_id: targetId,
          decision: "deny",
          reason_code: "insufficient_privilege",
          metadata: { caller_roles: callerRoleList, old_role: oldRole, new_role: newRole },
          ip: reqMeta.ip,
          user_agent: reqMeta.userAgent,
        });
        return new Response(JSON.stringify({ error: "Insufficient privileges to assign this role" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Additional guard: only developers can assign developer role
      if (newRole === "developer" && !callerRoleList.includes("developer")) {
        return new Response(JSON.stringify({ error: "Only developers can assign developer role" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Execute: delete existing roles, insert new one
      await adminClient.from("user_roles").delete().eq("user_id", targetId);
      const { error: insertError } = await adminClient.from("user_roles").insert({
        user_id: targetId,
        role: newRole,
      });

      if (insertError) {
        console.error("[manage-member] role insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to update role" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Audit: successful role change
      await auditLog({
        event_type: "role_change",
        severity: "warn",
        endpoint: "manage-member",
        actor_user_id: callerId,
        actor_org_id: callerProfile.organization_id,
        target_type: "user",
        target_id: targetId,
        decision: "allow",
        reason_code: "role_changed",
        metadata: {
          old_role: oldRole,
          new_role: newRole,
          target_name: targetProfile.full_name,
          reason: reason || null,
        },
        ip: reqMeta.ip,
        user_agent: reqMeta.userAgent,
      });

      console.log(`[manage-member] Role changed: ${targetProfile.full_name} ${oldRole} → ${newRole} by ${callerId}`);

      return new Response(JSON.stringify({
        success: true,
        name: targetProfile.full_name,
        old_role: oldRole,
        new_role: newRole,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: remove_member (existing, now with audit)
    // ═══════════════════════════════════════════════════════
    if (action === "remove_member") {
      const { user_id: targetId, reason } = body;
      if (!targetId) throw new Error("user_id required");
      if (targetId === callerId) throw new Error("Cannot remove yourself");

      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("organization_id, full_name")
        .eq("user_id", targetId)
        .single();

      if (!targetProfile || targetProfile.organization_id !== callerProfile.organization_id) {
        await auditLog({
          event_type: "member_removal",
          severity: "error",
          endpoint: "manage-member",
          actor_user_id: callerId,
          actor_org_id: callerProfile.organization_id,
          target_type: "user",
          target_id: targetId,
          decision: "deny",
          reason_code: "cross_org",
          ip: reqMeta.ip,
          user_agent: reqMeta.userAgent,
        });
        throw new Error("User not in your organization");
      }

      const { data: targetRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", targetId);
      const targetRoleList = (targetRoles || []).map((r: any) => r.role);
      const isDeveloper = callerRoleList.includes("developer");

      if (targetRoleList.includes("developer") && !isDeveloper) {
        throw new Error("Cannot remove a developer");
      }
      if (targetRoleList.includes("admin") && !isDeveloper) {
        throw new Error("Cannot remove an admin");
      }

      // Log the removal event
      await adminClient.from("organization_member_events").insert({
        organization_id: callerProfile.organization_id,
        user_id: targetId,
        event_type: "removed",
        performed_by: callerId,
        reason: reason || null,
        metadata: { member_name: targetProfile.full_name, roles: targetRoleList },
      });

      await adminClient
        .from("profiles")
        .update({ organization_id: null, removed_at: new Date().toISOString(), custom_role_id: null })
        .eq("user_id", targetId);

      await adminClient.from("user_roles").delete().eq("user_id", targetId);

      // Unassign across all org-scoped resources so the removed member
      // does not retain any active linkage.
      await adminClient
        .from("leads")
        .update({ broker_id: null })
        .eq("broker_id", targetId)
        .eq("organization_id", callerProfile.organization_id);

      await adminClient
        .from("tasks")
        .update({ assigned_to: null } as any)
        .eq("assigned_to", targetId)
        .eq("organization_id", callerProfile.organization_id);

      await adminClient
        .from("appointments")
        .update({ assigned_to: null } as any)
        .eq("assigned_to", targetId)
        .eq("organization_id", callerProfile.organization_id);

      // inbox_assignments.assigned_to is NOT NULL — delete the row so the
      // conversation goes back to the unassigned pool.
      await adminClient
        .from("inbox_assignments")
        .delete()
        .eq("assigned_to", targetId)
        .eq("organization_id", callerProfile.organization_id);

      await adminClient
        .from("contracts")
        .update({ broker_id: null } as any)
        .eq("broker_id", targetId)
        .eq("organization_id", callerProfile.organization_id);

      // commissions.broker_id is NOT NULL — keep historical record but mark
      // the broker reference as the org admin (caller) so reports stay intact.
      // We do NOT delete because commissions are financial history.
      await adminClient
        .from("commissions")
        .update({ broker_id: callerId } as any)
        .eq("broker_id", targetId)
        .eq("organization_id", callerProfile.organization_id);

      // Invalidate ALL active sessions immediately (kills JWT + refresh tokens).
      try {
        await adminClient.auth.admin.signOut(targetId, "global");
      } catch (signOutErr) {
        console.error("[manage-member] signOut failed:", signOutErr);
      }

      // Also clean our internal session tracking table (used by useSessionGuard).
      try {
        await adminClient.from("user_sessions").delete().eq("user_id", targetId);
      } catch {
        // Non-fatal
      }

      // Security audit
      await auditLog({
        event_type: "member_removal",
        severity: "warn",
        endpoint: "manage-member",
        actor_user_id: callerId,
        actor_org_id: callerProfile.organization_id,
        target_type: "user",
        target_id: targetId,
        decision: "allow",
        reason_code: "member_removed",
        metadata: {
          target_name: targetProfile.full_name,
          target_roles: targetRoleList,
          reason: reason || null,
        },
        ip: reqMeta.ip,
        user_agent: reqMeta.userAgent,
      });

      return new Response(JSON.stringify({ success: true, name: targetProfile.full_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════
    // ACTION: get_member_stats (existing, unchanged)
    // ═══════════════════════════════════════════════════════
    if (action === "get_member_stats") {
      const orgId = callerProfile.organization_id;

      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, full_name, created_at, custom_role_id")
        .eq("organization_id", orgId);

      if (!profiles?.length) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const userIds = profiles.map((p: any) => p.user_id);

      const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const authMap = new Map(users.map((u) => [u.id, { last_sign_in_at: u.last_sign_in_at, email: u.email }]));

      const { data: roles } = await adminClient
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: activities } = await adminClient
        .from("activity_log")
        .select("user_id, action_type, entity_type")
        .eq("organization_id", orgId)
        .gte("created_at", thirtyDaysAgo)
        .in("user_id", userIds);

      const { data: leads } = await adminClient
        .from("leads")
        .select("broker_id")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .in("broker_id", userIds);

      const { data: contracts } = await adminClient
        .from("contracts")
        .select("broker_id")
        .eq("organization_id", orgId)
        .in("broker_id", userIds);

      const { data: properties } = await adminClient
        .from("properties")
        .select("created_by")
        .eq("organization_id", orgId)
        .in("created_by", userIds);

      const result = profiles.map((p: any) => {
        const auth = authMap.get(p.user_id);
        const userRoles = (roles || []).filter((r: any) => r.user_id === p.user_id).map((r: any) => r.role);
        const userActivities = (activities || []).filter((a: any) => a.user_id === p.user_id);
        const userLeads = (leads || []).filter((l: any) => l.broker_id === p.user_id).length;
        const userContracts = (contracts || []).filter((c: any) => c.broker_id === p.user_id).length;
        const userProperties = (properties || []).filter((pr: any) => pr.created_by === p.user_id).length;

        return {
          user_id: p.user_id,
          full_name: p.full_name,
          email: auth?.email || null,
          last_sign_in_at: auth?.last_sign_in_at || null,
          joined_at: p.created_at,
          roles: userRoles.length > 0 ? userRoles : ["corretor"],
          custom_role_id: p.custom_role_id,
          total_actions_30d: userActivities.length,
          active_leads: userLeads,
          total_contracts: userContracts,
          total_properties: userProperties,
          actions_by_type: userActivities.reduce((acc: any, a: any) => {
            acc[a.action_type] = (acc[a.action_type] || 0) + 1;
            return acc;
          }, {}),
        };
      });

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("Forbidden") ? 403 : msg.includes("Unauthorized") ? 401 : 400;
    console.error("[manage-member]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
