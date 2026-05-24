import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import {
  DEVELOPER_ONLY_FEATURES,
  DEVELOPER_ONLY_ROUTES,
  isDeveloperOnlyRoute,
  isDeveloperOnlyFeature,
} from "@/config/featureAccess";

// Mock toast (sonner) so the route guard's toast.error doesn't blow up in jsdom.
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock useUserRoles — toggled per-test via `setMockRole`.
let mockRole: { isDeveloper: boolean; isLoading: boolean } = {
  isDeveloper: false,
  isLoading: false,
};
function setMockRole(next: Partial<typeof mockRole>) {
  mockRole = { ...mockRole, ...next };
}
vi.mock("@/hooks/useUserRole", () => ({
  useUserRoles: () => mockRole,
}));

// Import AFTER mocks so the components pick them up.
import { DeveloperOnlyRoute } from "@/components/access/DeveloperOnlyRoute";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { renderHook } from "@testing-library/react";

beforeEach(() => {
  setMockRole({ isDeveloper: false, isLoading: false });
});

describe("featureAccess config", () => {
  it("/financiamentos is NOT a standalone developer-only route (it's a tab)", () => {
    expect(DEVELOPER_ONLY_ROUTES).not.toContain("/financiamentos");
    expect(isDeveloperOnlyRoute("/financiamentos")).toBe(false);
    // …but the underlying feature key still exists for the in-page tab gating.
    expect(isDeveloperOnlyFeature(DEVELOPER_ONLY_FEATURES.FINANCEIRO_FINANCIAMENTOS)).toBe(true);
  });

  it("flags real developer-only routes (and their subpaths)", () => {
    expect(isDeveloperOnlyRoute("/correspondente")).toBe(true);
    expect(isDeveloperOnlyRoute("/automacoes")).toBe(true);
    expect(isDeveloperOnlyRoute("/whatsapp/automacoes")).toBe(true);
    expect(isDeveloperOnlyRoute("/whatsapp/canais-equipe")).toBe(true);
  });

  it("does not flag '/whatsapp/meu-canal' as developer-only (standardized as plan-gated instead)", () => {
    expect(isDeveloperOnlyRoute("/whatsapp/meu-canal")).toBe(false);
  });

  it("does not flag common routes", () => {
    expect(isDeveloperOnlyRoute("/dashboard")).toBe(false);
    expect(isDeveloperOnlyRoute("/financeiro")).toBe(false);
    expect(isDeveloperOnlyRoute("/crm")).toBe(false);
    expect(isDeveloperOnlyRoute("/anuncios")).toBe(false);
    expect(isDeveloperOnlyRoute("/integracoes")).toBe(false);
  });
});

describe("useFeatureAccess hook", () => {
  it("developer can access every restricted feature & route", () => {
    setMockRole({ isDeveloper: true, isLoading: false });
    const { result } = renderHook(() => useFeatureAccess());
    for (const key of Object.values(DEVELOPER_ONLY_FEATURES)) {
      expect(result.current.canAccessFeature(key)).toBe(true);
    }
    for (const path of DEVELOPER_ONLY_ROUTES) {
      expect(result.current.canAccessRoute(path)).toBe(true);
    }
  });

  it("non-developer is blocked from restricted tabs (CRM, Financeiro, Marketing, Integrações)", () => {
    setMockRole({ isDeveloper: false, isLoading: false });
    const { result } = renderHook(() => useFeatureAccess());

    // CRM
    expect(result.current.canAccessFeature(DEVELOPER_ONLY_FEATURES.CRM_WHATSAPP_TEMPLATES)).toBe(false);
    // Financeiro
    expect(result.current.canAccessFeature(DEVELOPER_ONLY_FEATURES.FINANCEIRO_TEMPLATES)).toBe(false);
    expect(result.current.canAccessFeature(DEVELOPER_ONLY_FEATURES.FINANCEIRO_FINANCIAMENTOS)).toBe(false);
    // Marketing
    expect(result.current.canAccessFeature(DEVELOPER_ONLY_FEATURES.MARKETING_GERADOR_IA)).toBe(false);
    expect(result.current.canAccessFeature(DEVELOPER_ONLY_FEATURES.MARKETING_ARTES)).toBe(false);
    expect(result.current.canAccessFeature(DEVELOPER_ONLY_FEATURES.MARKETING_VIDEO)).toBe(false);
    expect(result.current.canAccessFeature(DEVELOPER_ONLY_FEATURES.MARKETING_MARCA)).toBe(false);
    // Integrações / Gestão
    expect(result.current.canAccessFeature(DEVELOPER_ONLY_FEATURES.GESTAO_PORTAIS_ANUNCIO)).toBe(false);
    expect(result.current.canAccessFeature(DEVELOPER_ONLY_FEATURES.GESTAO_MEU_SITE)).toBe(false);

    // Non-restricted feature key — defaults to allowed.
    expect(result.current.canAccessFeature("any.public.feature")).toBe(true);
  });
});

function renderRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/correspondente"
          element={
            <DeveloperOnlyRoute>
              <div>CORRESPONDENTE_CONTENT</div>
            </DeveloperOnlyRoute>
          }
        />
        <Route path="/dashboard" element={<div>DASHBOARD_CONTENT</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("<DeveloperOnlyRoute />", () => {
  it("renders children when user is developer", () => {
    setMockRole({ isDeveloper: true, isLoading: false });
    renderRoute("/correspondente");
    expect(screen.getByText("CORRESPONDENTE_CONTENT")).toBeInTheDocument();
  });

  it("redirects non-developer to /dashboard", () => {
    setMockRole({ isDeveloper: false, isLoading: false });
    renderRoute("/correspondente");
    expect(screen.queryByText("CORRESPONDENTE_CONTENT")).not.toBeInTheDocument();
    expect(screen.getByText("DASHBOARD_CONTENT")).toBeInTheDocument();
  });
});
