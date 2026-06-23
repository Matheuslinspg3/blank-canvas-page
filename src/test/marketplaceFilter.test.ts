import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regressão: o filtro `.neq("organization_id", organizationId)` foi removido do
 * Marketplace para permitir visibilidade entre orgs. Este teste lê o fonte e
 * falha se alguém reintroduzir o filtro no hook `useMarketplace`.
 */
describe("useMarketplace cross-org visibility", () => {
  const src = readFileSync(resolve(__dirname, "../hooks/useMarketplace.ts"), "utf-8");

  it("does not filter out the user's own organization inside applyFilters", () => {
    // Permite outros usos de `.neq("organization_id", ...)` em queries auxiliares
    // de filtros (cities/neighborhoods/etc), mas dentro de `applyFilters` (queries
    // principais de properties) o filtro precisa estar ausente.
    const start = src.indexOf("const applyFilters");
    const end = src.indexOf("}, [organizationId");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const body = src.slice(start, end);
    expect(body).not.toMatch(/\.neq\(\s*["']organization_id["']/);
  });

  it("queries the public marketplace view", () => {
    expect(src).toContain("marketplace_properties_public");
  });
});
