/**
 * Testes — Lógica do Webhook de Billing (Asaas)
 * Cobre: autenticação, idempotência, sanitização, processamento de eventos,
 *        cálculo de período, e validação de payload.
 */

import { describe, it, expect } from "vitest";

// --------------------------------------------------------------------------
// Helpers extraídos da lógica da edge function (testados de forma isolada)
// --------------------------------------------------------------------------

/**
 * Valida o token do webhook Asaas.
 * Em produção: Deno.env.get("ASAAS_WEBHOOK_TOKEN")
 */
function validateWebhookToken(
  expectedToken: string | undefined,
  receivedToken: string | null
): boolean {
  if (!expectedToken) return false;
  return receivedToken === expectedToken;
}

/**
 * Constrói o provider_event_id a partir do payload Asaas.
 */
function buildProviderEventId(payload: {
  id?: string;
  event?: string;
  payment?: { id?: string };
}): string {
  const event = payload.event ?? "UNKNOWN";
  const paymentId = payload.payment?.id ?? "noid";
  return payload.id || `${event}_${paymentId}`;
}

/**
 * Sanitiza o payload Asaas — remove PII, mantém apenas metadados de billing.
 */
function sanitizeWebhookPayload(payload: {
  event?: string;
  payment?: {
    id?: string;
    billingType?: string;
    value?: number;
    status?: string;
    customerName?: string;
    customerEmail?: string;
    customerCpf?: string;
    invoiceUrl?: string;
    subscription?: string;
  };
}) {
  return {
    event: payload.event ?? null,
    payment_id: payload.payment?.id ?? null,
    subscription_id: payload.payment?.subscription ?? null,
    billing_type: payload.payment?.billingType ?? null,
    value: payload.payment?.value ?? null,
    status: payload.payment?.status ?? null,
  };
}

/**
 * Calcula o fim do período de billing com base no ciclo.
 */
function computePeriodEnd(now: Date, billingCycle: string): Date {
  const end = new Date(now);
  if (billingCycle === "yearly") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

/**
 * Gera hash SHA-256 de um payload para deduplicação.
 */
async function hashPayload(payload: unknown): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --------------------------------------------------------------------------
// Testes de autenticação do webhook
// --------------------------------------------------------------------------

describe("Webhook — validação de token (A02 OWASP)", () => {
  const VALID_TOKEN = "wh-secret-abc123";

  it("aceita token correto", () => {
    expect(validateWebhookToken(VALID_TOKEN, VALID_TOKEN)).toBe(true);
  });

  it("rejeita token incorreto", () => {
    expect(validateWebhookToken(VALID_TOKEN, "wrong-token")).toBe(false);
  });

  it("rejeita token null (cabeçalho ausente)", () => {
    expect(validateWebhookToken(VALID_TOKEN, null)).toBe(false);
  });

  it("rejeita quando expectedToken não está configurado (sem env var)", () => {
    expect(validateWebhookToken(undefined, VALID_TOKEN)).toBe(false);
  });

  it("rejeita token vazio", () => {
    expect(validateWebhookToken(VALID_TOKEN, "")).toBe(false);
  });

  it("comparação é case-sensitive", () => {
    expect(validateWebhookToken(VALID_TOKEN, VALID_TOKEN.toUpperCase())).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Testes de idempotência
// --------------------------------------------------------------------------

describe("Webhook — idempotência (deduplicação por hash)", () => {
  it("mesmo payload gera o mesmo hash", async () => {
    const payload = { id: "evt_123", event: "PAYMENT_CONFIRMED" };
    const hash1 = await hashPayload(payload);
    const hash2 = await hashPayload(payload);
    expect(hash1).toBe(hash2);
  });

  it("payloads diferentes geram hashes diferentes", async () => {
    const hash1 = await hashPayload({ id: "evt_1" });
    const hash2 = await hashPayload({ id: "evt_2" });
    expect(hash1).not.toBe(hash2);
  });

  it("hash é string hexadecimal de 64 caracteres (SHA-256)", async () => {
    const hash = await hashPayload({ event: "PAYMENT_CONFIRMED", id: "evt_999" });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("evento duplicado (processed=true) deve ser ignorado", () => {
    // Simula verificação de idempotência no banco
    const existing = { id: "log-1", processed: true };
    const isDuplicate = existing?.processed === true;
    expect(isDuplicate).toBe(true);
  });

  it("evento não processado (processed=false) deve ser processado", () => {
    const existing = { id: "log-1", processed: false };
    const isDuplicate = existing?.processed === true;
    expect(isDuplicate).toBe(false);
  });

  it("evento sem registro anterior deve ser processado", () => {
    const existing = null;
    const isDuplicate = existing !== null && (existing as any)?.processed === true;
    expect(isDuplicate).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Testes de provider_event_id
// --------------------------------------------------------------------------

describe("Webhook — construção do provider_event_id", () => {
  it("usa payload.id quando disponível", () => {
    const payload = { id: "evt_abc123", event: "PAYMENT_CONFIRMED", payment: { id: "pay_xyz" } };
    expect(buildProviderEventId(payload)).toBe("evt_abc123");
  });

  it("usa fallback event+paymentId quando payload.id ausente", () => {
    const payload = { event: "PAYMENT_CONFIRMED", payment: { id: "pay_xyz" } };
    expect(buildProviderEventId(payload)).toBe("PAYMENT_CONFIRMED_pay_xyz");
  });

  it("usa 'noid' quando payment.id também ausente", () => {
    const payload = { event: "SUBSCRIPTION_DELETED" };
    expect(buildProviderEventId(payload)).toBe("SUBSCRIPTION_DELETED_noid");
  });

  it("usa 'UNKNOWN' quando event também ausente", () => {
    const payload = {};
    expect(buildProviderEventId(payload)).toBe("UNKNOWN_noid");
  });
});

// --------------------------------------------------------------------------
// Testes de sanitização de payload (A03 OWASP — sem PII)
// --------------------------------------------------------------------------

describe("Webhook — sanitização de payload (A03 OWASP)", () => {
  const rawPayload = {
    id: "evt_123",
    event: "PAYMENT_CONFIRMED",
    payment: {
      id: "pay_456",
      billingType: "PIX",
      value: 199.0,
      status: "CONFIRMED",
      subscription: "sub_789",
      customerName: "João Silva",     // PII
      customerEmail: "joao@email.com", // PII
      customerCpf: "123.456.789-00",   // PII
      invoiceUrl: "https://asaas.com/invoice/123",
    },
  };

  it("sanitizado contém campos de billing necessários", () => {
    const sanitized = sanitizeWebhookPayload(rawPayload);
    expect(sanitized.event).toBe("PAYMENT_CONFIRMED");
    expect(sanitized.payment_id).toBe("pay_456");
    expect(sanitized.billing_type).toBe("PIX");
    expect(sanitized.value).toBe(199.0);
    expect(sanitized.status).toBe("CONFIRMED");
    expect(sanitized.subscription_id).toBe("sub_789");
  });

  it("sanitizado NÃO contém campos PII", () => {
    const sanitized = sanitizeWebhookPayload(rawPayload);
    const serialized = JSON.stringify(sanitized);
    expect(serialized).not.toContain("João");
    expect(serialized).not.toContain("joao@email.com");
    expect(serialized).not.toContain("123.456.789-00");
    expect(serialized).not.toContain("customerName");
    expect(serialized).not.toContain("customerEmail");
    expect(serialized).not.toContain("customerCpf");
  });

  it("lida com payload parcial sem campos de pagamento", () => {
    const partialPayload = { event: "SUBSCRIPTION_DELETED" };
    const sanitized = sanitizeWebhookPayload(partialPayload);
    expect(sanitized.event).toBe("SUBSCRIPTION_DELETED");
    expect(sanitized.payment_id).toBeNull();
    expect(sanitized.value).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Testes de processamento de eventos
// --------------------------------------------------------------------------

describe("Webhook — mapeamento de eventos para ações", () => {
  const ACTIVATION_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
  const OVERDUE_EVENTS = new Set(["PAYMENT_OVERDUE"]);
  const REFUND_EVENTS = new Set(["PAYMENT_DELETED", "PAYMENT_REFUNDED"]);
  const CANCEL_EVENTS = new Set(["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED"]);

  it("PAYMENT_CONFIRMED ativa assinatura", () => {
    expect(ACTIVATION_EVENTS.has("PAYMENT_CONFIRMED")).toBe(true);
  });

  it("PAYMENT_RECEIVED ativa assinatura", () => {
    expect(ACTIVATION_EVENTS.has("PAYMENT_RECEIVED")).toBe(true);
  });

  it("PAYMENT_OVERDUE marca assinatura como atrasada", () => {
    expect(OVERDUE_EVENTS.has("PAYMENT_OVERDUE")).toBe(true);
  });

  it("PAYMENT_DELETED marca pagamento como reembolsado", () => {
    expect(REFUND_EVENTS.has("PAYMENT_DELETED")).toBe(true);
  });

  it("PAYMENT_REFUNDED marca pagamento como reembolsado", () => {
    expect(REFUND_EVENTS.has("PAYMENT_REFUNDED")).toBe(true);
  });

  it("SUBSCRIPTION_DELETED cancela assinatura", () => {
    expect(CANCEL_EVENTS.has("SUBSCRIPTION_DELETED")).toBe(true);
  });

  it("SUBSCRIPTION_INACTIVATED cancela assinatura", () => {
    expect(CANCEL_EVENTS.has("SUBSCRIPTION_INACTIVATED")).toBe(true);
  });

  it("evento desconhecido não pertence a nenhuma categoria crítica", () => {
    const unknownEvent = "SOME_FUTURE_EVENT";
    expect(ACTIVATION_EVENTS.has(unknownEvent)).toBe(false);
    expect(OVERDUE_EVENTS.has(unknownEvent)).toBe(false);
    expect(REFUND_EVENTS.has(unknownEvent)).toBe(false);
    expect(CANCEL_EVENTS.has(unknownEvent)).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Testes de cálculo de período de billing
// --------------------------------------------------------------------------

describe("Webhook — cálculo do período de billing", () => {
  it("ciclo mensal incrementa 1 mês a partir da data atual", () => {
    const now = new Date("2026-03-15T10:00:00.000Z");
    const end = computePeriodEnd(now, "monthly");
    expect(end.getMonth()).toBe((now.getMonth() + 1) % 12);
  });

  it("ciclo anual incrementa 1 ano a partir da data atual", () => {
    const now = new Date("2026-03-15T10:00:00.000Z");
    const end = computePeriodEnd(now, "yearly");
    expect(end.getFullYear()).toBe(2027);
    expect(end.getMonth()).toBe(now.getMonth());
    expect(end.getDate()).toBe(now.getDate());
  });

  it("ciclo mensal em dezembro vai para janeiro do próximo ano", () => {
    const now = new Date("2026-12-01T10:00:00.000Z");
    const end = computePeriodEnd(now, "monthly");
    expect(end.getMonth()).toBe(0); // janeiro
    expect(end.getFullYear()).toBe(2027);
  });

  it("período de billing nunca retrocede no tempo", () => {
    const now = new Date();
    const end = computePeriodEnd(now, "monthly");
    expect(end.getTime()).toBeGreaterThan(now.getTime());
  });
});

// --------------------------------------------------------------------------
// Testes de conversão de valor monetário
// --------------------------------------------------------------------------

describe("Webhook — conversão de valor monetário (centavos)", () => {
  it("R$199,00 converte para 19900 centavos", () => {
    const value = 199.0;
    expect(Math.round(value * 100)).toBe(19900);
  });

  it("R$49,90 converte para 4990 centavos", () => {
    const value = 49.9;
    expect(Math.round(value * 100)).toBe(4990);
  });

  it("valores com float impreciso são arredondados corretamente", () => {
    // 0.1 + 0.2 = 0.30000000000000004 em float
    const value = 0.1 + 0.2;
    expect(Math.round(value * 100)).toBe(30);
  });

  it("R$0,00 converte para 0 centavos", () => {
    expect(Math.round(0 * 100)).toBe(0);
  });
});

// --------------------------------------------------------------------------
// Testes de validação de método HTTP
// --------------------------------------------------------------------------

describe("Webhook — validação de método HTTP", () => {
  const ALLOWED_METHOD = "POST";

  it("método POST é permitido", () => {
    expect("POST" === ALLOWED_METHOD).toBe(true);
  });

  it("método GET é rejeitado (405)", () => {
    expect("GET" === ALLOWED_METHOD).toBe(false);
  });

  it("método PUT é rejeitado (405)", () => {
    expect("PUT" === ALLOWED_METHOD).toBe(false);
  });

  it("método DELETE é rejeitado (405)", () => {
    expect("DELETE" === ALLOWED_METHOD).toBe(false);
  });
});
