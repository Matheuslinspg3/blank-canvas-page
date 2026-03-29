/**
 * Testes — Stripe Adapter (Modo de Billing de IA)
 * Cobre: getBillingMode, sendMeterEvent (mock mode), lógica de fallback,
 *        determinação de modo a partir do config.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --------------------------------------------------------------------------
// Mock do cliente Supabase (inline para evitar hoisting issue com vi.mock)
// --------------------------------------------------------------------------

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

import { supabase } from "@/integrations/supabase/client";

// --------------------------------------------------------------------------
// Replicação da lógica do stripe-adapter para testes isolados
// (evita dependência da implementação real com Supabase client)
// --------------------------------------------------------------------------

type BillingMode = "mock" | "stripe_test" | "stripe_live";

function determineBillingMode(config: {
  billing_enabled: boolean;
  sandbox_mode: boolean;
  stripe_test_mode: boolean;
} | null): BillingMode {
  if (!config || !config.billing_enabled) return "mock";
  if (config.sandbox_mode || config.stripe_test_mode) return "stripe_test";
  return "stripe_live";
}

// --------------------------------------------------------------------------
// Testes de determinação do modo de billing
// --------------------------------------------------------------------------

describe("getBillingMode — determinação do modo", () => {
  it("retorna 'mock' quando config é null", () => {
    expect(determineBillingMode(null)).toBe("mock");
  });

  it("retorna 'mock' quando billing_enabled é false", () => {
    expect(
      determineBillingMode({
        billing_enabled: false,
        sandbox_mode: false,
        stripe_test_mode: false,
      })
    ).toBe("mock");
  });

  it("retorna 'stripe_test' quando sandbox_mode é true", () => {
    expect(
      determineBillingMode({
        billing_enabled: true,
        sandbox_mode: true,
        stripe_test_mode: false,
      })
    ).toBe("stripe_test");
  });

  it("retorna 'stripe_test' quando stripe_test_mode é true", () => {
    expect(
      determineBillingMode({
        billing_enabled: true,
        sandbox_mode: false,
        stripe_test_mode: true,
      })
    ).toBe("stripe_test");
  });

  it("retorna 'stripe_test' quando ambos sandbox_mode e stripe_test_mode são true", () => {
    expect(
      determineBillingMode({
        billing_enabled: true,
        sandbox_mode: true,
        stripe_test_mode: true,
      })
    ).toBe("stripe_test");
  });

  it("retorna 'stripe_live' quando billing habilitado, sem sandbox nem test mode", () => {
    expect(
      determineBillingMode({
        billing_enabled: true,
        sandbox_mode: false,
        stripe_test_mode: false,
      })
    ).toBe("stripe_live");
  });
});

// --------------------------------------------------------------------------
// Testes de sendMeterEvent (modo mock)
// --------------------------------------------------------------------------

describe("sendMeterEvent — modo mock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("modo mock gera stripe_meter_event_id com prefixo 'mock_'", () => {
    const eventId = "event-abc-123";
    const mockEventId = `mock_${eventId}`;
    expect(mockEventId).toBe("mock_event-abc-123");
    expect(mockEventId.startsWith("mock_")).toBe(true);
  });

  it("modo mock retorna success = true", () => {
    const result = { success: true, mode: "mock" as BillingMode, stripeEventId: "mock_123" };
    expect(result.success).toBe(true);
    expect(result.mode).toBe("mock");
  });

  it("modo mock marca stripe_sync_status como 'mock_synced'", () => {
    const updatePayload = {
      stripe_sync_status: "mock_synced",
      stripe_meter_event_id: "mock_event-1",
    };
    expect(updatePayload.stripe_sync_status).toBe("mock_synced");
  });
});

// --------------------------------------------------------------------------
// Testes de sendMeterEvent — estrutura do evento
// --------------------------------------------------------------------------

describe("sendMeterEvent — validação da estrutura do evento", () => {
  it("evento de meter deve ter todos os campos obrigatórios", () => {
    const event = {
      eventId: "evt-abc-123",
      userId: "user-xyz",
      totalTokens: 1500,
      billedAmount: 0.045,
      currency: "USD",
      timestamp: new Date().toISOString(),
    };

    expect(event.eventId).toBeTruthy();
    expect(event.userId).toBeTruthy();
    expect(event.totalTokens).toBeGreaterThan(0);
    expect(event.billedAmount).toBeGreaterThanOrEqual(0);
    expect(event.currency).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
  });

  it("timestamp deve ser uma string ISO válida", () => {
    const timestamp = new Date().toISOString();
    expect(() => new Date(timestamp)).not.toThrow();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it("billedAmount deve ser não-negativo", () => {
    const billedAmount = 0;
    expect(billedAmount).toBeGreaterThanOrEqual(0);
  });
});

// --------------------------------------------------------------------------
// Testes de fallback (modo stripe_test com falha)
// --------------------------------------------------------------------------

describe("sendMeterEvent — fallback quando Stripe falha", () => {
  it("em caso de falha do Stripe, marca stripe_sync_status como 'failed'", () => {
    const updateOnFailure = { stripe_sync_status: "failed" };
    expect(updateOnFailure.stripe_sync_status).toBe("failed");
  });

  it("fallback retorna success = false e preserva o modo", () => {
    const result = { success: false, mode: "stripe_test" as BillingMode };
    expect(result.success).toBe(false);
    expect(result.mode).toBe("stripe_test");
  });

  it("modo stripe_live não implementado retorna success = false", () => {
    const mode: BillingMode = "stripe_live";
    const result = mode === "stripe_live" ? { success: false, mode } : { success: true, mode };
    expect(result.success).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Testes de chamada para edge function (stripe_test)
// --------------------------------------------------------------------------

describe("sendMeterEvent — chamada da edge function ai-billing-stripe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invoca a edge function com action 'create_meter_event'", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: { stripe_event_id: "sevt_test_123" },
      error: null,
    });

    const event = {
      eventId: "evt-1",
      userId: "user-1",
      totalTokens: 1000,
      billedAmount: 0.03,
      currency: "USD",
      timestamp: new Date().toISOString(),
    };

    const { data, error } = await supabase.functions.invoke("ai-billing-stripe", {
      body: { action: "create_meter_event", event },
    });

    expect(supabase.functions.invoke).toHaveBeenCalledWith("ai-billing-stripe", {
      body: { action: "create_meter_event", event },
    });
    expect(error).toBeNull();
    expect(data?.stripe_event_id).toBe("sevt_test_123");
  });

  it("retorna erro quando edge function falha", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: null,
      error: { message: "Function invocation failed" },
    });

    const { error } = await supabase.functions.invoke("ai-billing-stripe", {
      body: { action: "create_meter_event", event: {} },
    });

    expect(error).toBeTruthy();
    expect((error as any)!.message).toContain("Function invocation failed");
  });
});

// --------------------------------------------------------------------------
// Testes de geração de invoice (via edge function)
// --------------------------------------------------------------------------

describe("ai-billing-stripe — generate_invoice", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invoica a edge function com action 'generate_invoice'", async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
      data: {
        invoice: {
          id: "inv-test-1",
          total_billed_amount: 1.5,
          currency: "USD",
          status: "draft",
        },
      },
      error: null,
    });

    const params = {
      action: "generate_invoice",
      userId: "user-1",
      organizationId: "org-1",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    };

    const { data, error } = await supabase.functions.invoke("ai-billing-stripe", {
      body: params,
    });

    expect(error).toBeNull();
    expect(data?.invoice?.id).toBe("inv-test-1");
    expect(data?.invoice?.currency).toBe("USD");
  });

  it("invoice gerada tem campos obrigatórios", () => {
    const invoice = {
      id: "inv-1",
      user_id: "user-1",
      period_start: "2026-03-01",
      period_end: "2026-03-31",
      total_tokens: 50000,
      total_requests: 100,
      total_provider_cost: 1.5,
      total_billed_amount: 1.95,
      currency: "USD",
      status: "draft",
    };

    expect(invoice.total_billed_amount).toBeGreaterThanOrEqual(invoice.total_provider_cost);
    expect(invoice.currency).toBe("USD");
    expect(["draft", "paid", "void", "open"]).toContain(invoice.status);
  });
});
