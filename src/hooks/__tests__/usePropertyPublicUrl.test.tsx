import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ---- Mocks ----
const mockOrgQueryData: {
  slug: string | null;
  siteActive: boolean;
  useCustomDomainUrl: boolean;
  useSubdomainLanding: boolean;
  activeDomain: string | null;
} = {
  slug: "portocaicara",
  siteActive: true,
  useCustomDomainUrl: false,
  useSubdomainLanding: true,
  activeDomain: null,
};

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query"
  );
  return {
    ...actual,
    useQuery: () => ({ data: mockOrgQueryData }),
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: { organization_id: "org-1" } }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

import { usePropertyPublicUrl } from "@/hooks/usePropertyPublicUrl";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  // reset to defaults
  mockOrgQueryData.slug = "portocaicara";
  mockOrgQueryData.siteActive = true;
  mockOrgQueryData.useCustomDomainUrl = false;
  mockOrgQueryData.useSubdomainLanding = true;
  mockOrgQueryData.activeDomain = null;

  Object.defineProperty(window, "location", {
    value: { origin: "https://app.example.com" },
    writable: true,
  });
});

describe("usePropertyPublicUrl — QR Code link generation", () => {
  it("usa o domínio próprio quando use_custom_domain_url=true e há activeDomain", () => {
    mockOrgQueryData.useCustomDomainUrl = true;
    mockOrgQueryData.activeDomain = "www.portocaicaraimoveis.com.br";

    const { result } = renderHook(() => usePropertyPublicUrl(), { wrapper });
    const url = result.current.buildPublicUrl("uuid-123", "PCI-42");

    expect(url).toBe("https://www.portocaicaraimoveis.com.br/imovel/PCI-42");
  });

  it("usa o code (não o uuid) quando propertyCode é fornecido", () => {
    mockOrgQueryData.useCustomDomainUrl = true;
    mockOrgQueryData.activeDomain = "www.portocaicaraimoveis.com.br";

    const { result } = renderHook(() => usePropertyPublicUrl(), { wrapper });
    const url = result.current.buildPublicUrl("uuid-123", "PCI-42");

    expect(url).toContain("/imovel/PCI-42");
    expect(url).not.toContain("uuid-123");
  });

  it("cai para o uuid quando propertyCode está ausente, mantendo o domínio próprio", () => {
    mockOrgQueryData.useCustomDomainUrl = true;
    mockOrgQueryData.activeDomain = "www.portocaicaraimoveis.com.br";

    const { result } = renderHook(() => usePropertyPublicUrl(), { wrapper });
    const url = result.current.buildPublicUrl("uuid-123", null);

    expect(url).toBe("https://www.portocaicaraimoveis.com.br/imovel/uuid-123");
  });

  it("usa subdomínio da plataforma quando use_custom_domain_url=false", () => {
    mockOrgQueryData.useCustomDomainUrl = false;
    mockOrgQueryData.activeDomain = "www.portocaicaraimoveis.com.br";

    const { result } = renderHook(() => usePropertyPublicUrl(), { wrapper });
    const url = result.current.buildPublicUrl("uuid-123", "PCI-42");

    expect(url).toBe("https://portocaicara.portadocorretor.com.br/imovel/PCI-42");
  });

  it("usa subdomínio quando use_custom_domain_url=true mas não há activeDomain (fallback seguro)", () => {
    mockOrgQueryData.useCustomDomainUrl = true;
    mockOrgQueryData.activeDomain = null;

    const { result } = renderHook(() => usePropertyPublicUrl(), { wrapper });
    const url = result.current.buildPublicUrl("uuid-123", "PCI-42");

    expect(url).toBe("https://portocaicara.portadocorretor.com.br/imovel/PCI-42");
  });

  it("usa caminho local quando o site não está ativo", () => {
    mockOrgQueryData.siteActive = false;
    mockOrgQueryData.useCustomDomainUrl = true;
    mockOrgQueryData.activeDomain = "www.portocaicaraimoveis.com.br";

    const { result } = renderHook(() => usePropertyPublicUrl(), { wrapper });
    const url = result.current.buildPublicUrl("uuid-123", "PCI-42");

    expect(url).toBe("https://app.example.com/imovel/uuid-123");
  });

  it("usa caminho local quando useSubdomainLanding=false", () => {
    mockOrgQueryData.useSubdomainLanding = false;
    mockOrgQueryData.useCustomDomainUrl = true;
    mockOrgQueryData.activeDomain = "www.portocaicaraimoveis.com.br";

    const { result } = renderHook(() => usePropertyPublicUrl(), { wrapper });
    const url = result.current.buildPublicUrl("uuid-123", "PCI-42");

    expect(url).toBe("https://app.example.com/imovel/uuid-123");
  });
});
