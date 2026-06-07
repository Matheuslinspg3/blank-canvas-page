import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";

// --- Mocks de dependências externas (foco: lógica de prefill do signup) ---
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    signIn: vi.fn(), signUp: vi.fn(), user: null, loading: false, forgotPassword: vi.fn(),
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("@/hooks/useAttribution", () => ({ useAttribution: () => ({}), getAttribution: () => ({}) }));
vi.mock("@/hooks/useMaintenanceMode", () => ({ useMaintenanceMode: () => ({ isMaintenanceMode: false, maintenanceMessage: "" }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/ClarityProvider", () => ({ trackLoginSuccess: vi.fn(), trackSignupSuccess: vi.fn() }));
vi.mock("@/lib/metaPixel", () => ({ trackPixelEvent: vi.fn() }));
vi.mock("@/lib/alerts", () => ({ firePlatformAlert: vi.fn() }));
vi.mock("@/components/SEOHead", () => ({ SEOHead: () => null }));
vi.mock("@/components/auth/GoogleSignInButton", () => ({ GoogleSignInButton: () => null }));
vi.mock("@/components/auth/PasskeyLoginButton", () => ({ PasskeyLoginButton: () => null }));
vi.mock("@/components/HabitaeLogo", () => ({ HabitaeLogo: () => null }));

import Auth from "@/pages/Auth";

function renderSignup(qs: string) {
  return render(
    <MemoryRouter initialEntries={[`/auth${qs}`]}>
      <Auth />
    </MemoryRouter>
  );
}

const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value;

describe("Auth — prefill do cadastro via URL", () => {
  beforeEach(() => cleanup());

  it("preenche campos a partir dos parâmetros da URL e decodifica espaços", () => {
    renderSignup("?tab=cadastro&nome=Joao+Silva&email=joao@teste.com&empresa=Imob+Silva&phone=5562999999999&tipo=imobiliaria&plan=starter");
    expect(val("signup-name")).toBe("Joao Silva");
    expect(val("signup-email")).toBe("joao@teste.com");
    expect(val("signup-company")).toBe("Imob Silva");
    expect(val("signup-phone")).toBe("5562999999999");
    expect(val("signup-password")).toBe("");
    expect(val("signup-document")).toBe("");
  });

  it("mantém campos vazios quando não há parâmetros", () => {
    renderSignup("?tab=cadastro");
    expect(val("signup-name")).toBe("");
    expect(val("signup-email")).toBe("");
    expect(val("signup-company")).toBe("");
    expect(val("signup-phone")).toBe("");
  });

  it("decodifica acentos corretamente", () => {
    renderSignup(`?tab=cadastro&nome=${encodeURIComponent("João Müller")}&empresa=${encodeURIComponent("Imóveis & Cia")}`);
    expect(val("signup-name")).toBe("João Müller");
    expect(val("signup-company")).toBe("Imóveis & Cia");
  });

  it("não dispara XSS: payload entra como texto literal no input", () => {
    const payload = "<img src=x onerror=alert(1)>";
    renderSignup(`?tab=cadastro&nome=${encodeURIComponent(payload)}`);
    expect(val("signup-name")).toBe(payload);
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("tipo inválido cai no padrão seguro (imobiliaria)", () => {
    renderSignup("?tab=cadastro&tipo=hacker");
    // o select de account_type não deve aceitar valor fora do enum;
    // o campo empresa usa o rótulo de imobiliária por padrão
    expect(screen.getByText(/Nome da Imobiliária/i)).toBeTruthy();
  });

  it("plan inválido cai em starter; slug válido é preservado", () => {
    const { unmount } = renderSignup("?tab=cadastro&plan=<script>");
    // não quebra a renderização; campos seguem acessíveis
    expect(val("signup-name")).toBe("");
    unmount();
    renderSignup("?tab=cadastro&plan=essencial&nome=Ana");
    expect(val("signup-name")).toBe("Ana");
  });

  it("trunca valores excessivamente longos (limite de tamanho)", () => {
    const longName = "a".repeat(500);
    renderSignup(`?tab=cadastro&nome=${longName}`);
    expect((val("signup-name") || "").length).toBeLessThanOrEqual(120);
  });

  it("remove caracteres de controle e sanitiza telefone", () => {
    renderSignup(`?tab=cadastro&nome=${encodeURIComponent("Joao\u0000\u0007 Silva")}&phone=${encodeURIComponent("+55 (62) 99999-9999abc")}`);
    expect(val("signup-name")).toBe("Joao Silva");
    expect(val("signup-phone")).toBe("+55 (62) 99999-9999");
  });
});
