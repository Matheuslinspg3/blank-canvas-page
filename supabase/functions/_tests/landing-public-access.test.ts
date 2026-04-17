/**
 * Smoke test — garante que a resolução pública de landing pages NÃO regrida.
 * Bate em RPCs anônimas e valida que org+imóvel conhecidos resolvem sem auth.
 *
 * Run: deno test --allow-net --allow-env supabase/functions/_tests/landing-public-access.test.ts
 */
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const ANON_KEY =
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ??
  Deno.env.get("SUPABASE_ANON_KEY")!;

const KNOWN_ORG_SLUG = "portocaicaraimoveis";
const KNOWN_CODE = "1557";

async function rpc(fn: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

Deno.test("anon: get_property_id_by_org_code resolves known property", async () => {
  const { status, body } = await rpc("get_property_id_by_org_code", {
    p_org_slug: KNOWN_ORG_SLUG,
    p_code: KNOWN_CODE,
  });
  assertEquals(status, 200, "RPC must return 200 for anon");
  assert(typeof body === "string" && body.length > 0, "Must return a uuid");
});

Deno.test("anon: get_public_property_by_org_code returns property data", async () => {
  const { status, body } = await rpc("get_public_property_by_org_code", {
    p_org_slug: KNOWN_ORG_SLUG,
    p_code: KNOWN_CODE,
  });
  assertEquals(status, 200);
  assert(body !== null, "Must return data, not null");
});

Deno.test("anon: unknown code returns null (not error)", async () => {
  const { status, body } = await rpc("get_property_id_by_org_code", {
    p_org_slug: KNOWN_ORG_SLUG,
    p_code: "999999999",
  });
  assertEquals(status, 200);
  assertEquals(body, null);
});
