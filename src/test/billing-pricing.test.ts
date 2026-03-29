/**
 * Testes unitários — Calculadora de Preços de Billing de IA
 * Cobre: calculateCost, usdToBrl, formatCost
 */

import { describe, it, expect } from "vitest";
import {
  calculateCost,
  usdToBrl,
  formatCost,
} from "@/services/ai-billing/pricing-calculator";
import type { PricingConfig } from "@/services/ai-billing/types";

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const gpt4Pricing: PricingConfig = {
  provider: "openai",
  model: "gpt-4",
  price_per_1k_input_tokens: 0.03,
  price_per_1k_output_tokens: 0.06,
  markup_percentage: 30,
  fixed_margin: 0,
  currency: "USD",
  is_active: true,
};

const pricingWithFixedMargin: PricingConfig = {
  ...gpt4Pricing,
  fixed_margin: 0.005,
};

const pricingWithBrl: PricingConfig = {
  ...gpt4Pricing,
  currency: "BRL",
};

// --------------------------------------------------------------------------
// calculateCost
// --------------------------------------------------------------------------

describe("calculateCost — sem configuração de pricing", () => {
  it("retorna custo zero quando pricing é null", () => {
    const result = calculateCost(1000, 500, null);
    expect(result.provider_cost).toBe(0);
    expect(result.markup_amount).toBe(0);
    expect(result.fixed_margin).toBe(0);
    expect(result.total_billed).toBe(0);
    expect(result.currency).toBe("USD");
  });
});

describe("calculateCost — cálculo padrão", () => {
  it("calcula custo de input tokens corretamente", () => {
    // 1000 input tokens × $0.03/1k = $0.03
    const result = calculateCost(1000, 0, gpt4Pricing);
    expect(result.provider_cost).toBeCloseTo(0.03, 6);
  });

  it("calcula custo de output tokens corretamente", () => {
    // 1000 output tokens × $0.06/1k = $0.06
    const result = calculateCost(0, 1000, gpt4Pricing);
    expect(result.provider_cost).toBeCloseTo(0.06, 6);
  });

  it("soma input + output tokens para custo do provedor", () => {
    // 1000 input ($0.03) + 500 output ($0.03) = $0.06
    const result = calculateCost(1000, 500, gpt4Pricing);
    expect(result.provider_cost).toBeCloseTo(0.06, 6);
  });

  it("aplica markup de 30% sobre o custo do provedor", () => {
    const result = calculateCost(1000, 1000, gpt4Pricing);
    // provider_cost = 0.03 + 0.06 = 0.09
    // markup = 0.09 * 0.30 = 0.027
    expect(result.markup_amount).toBeCloseTo(0.027, 6);
  });

  it("total_billed = provider_cost + markup_amount + fixed_margin", () => {
    const result = calculateCost(1000, 1000, gpt4Pricing);
    const expected = result.provider_cost + result.markup_amount + result.fixed_margin;
    expect(result.total_billed).toBeCloseTo(expected, 9);
  });

  it("preserva a moeda do pricing config", () => {
    const result = calculateCost(1000, 1000, pricingWithBrl);
    expect(result.currency).toBe("BRL");
  });

  it("usa USD como padrão quando currency não definida", () => {
    const pricing = { ...gpt4Pricing, currency: "" };
    const result = calculateCost(100, 100, pricing as PricingConfig);
    expect(result.currency).toBe("USD");
  });
});

describe("calculateCost — fixed_margin", () => {
  it("inclui fixed_margin no total_billed", () => {
    const result = calculateCost(1000, 1000, pricingWithFixedMargin);
    expect(result.fixed_margin).toBeCloseTo(0.005, 6);
    expect(result.total_billed).toBeCloseTo(
      result.provider_cost + result.markup_amount + 0.005,
      6
    );
  });

  it("fixed_margin zero não altera o cálculo base", () => {
    const withZero = calculateCost(1000, 1000, gpt4Pricing);
    expect(withZero.fixed_margin).toBe(0);
  });
});

describe("calculateCost — override de markup", () => {
  it("override de markup 0% resulta em sem cobrança adicional", () => {
    const result = calculateCost(1000, 1000, gpt4Pricing, 0);
    expect(result.markup_amount).toBe(0);
    expect(result.total_billed).toBeCloseTo(result.provider_cost, 9);
  });

  it("override de markup 50% é aplicado em vez do markup do pricing", () => {
    const result = calculateCost(1000, 1000, gpt4Pricing, 50);
    // provider_cost = 0.09, markup = 0.045
    expect(result.markup_amount).toBeCloseTo(0.09 * 0.5, 6);
  });

  it("override de markup tem prioridade sobre markup_percentage do pricing", () => {
    const resultDefault = calculateCost(1000, 1000, gpt4Pricing);
    const resultOverride = calculateCost(1000, 1000, gpt4Pricing, 10);
    expect(resultDefault.markup_amount).not.toBeCloseTo(resultOverride.markup_amount, 6);
  });
});

describe("calculateCost — casos extremos", () => {
  it("zero tokens resulta em custo zero", () => {
    const result = calculateCost(0, 0, gpt4Pricing);
    expect(result.provider_cost).toBe(0);
    expect(result.total_billed).toBe(0);
  });

  it("volume alto de tokens (1M input) calcula corretamente", () => {
    // 1_000_000 tokens × $0.03/1k = $30
    const result = calculateCost(1_000_000, 0, gpt4Pricing);
    expect(result.provider_cost).toBeCloseTo(30, 4);
  });

  it("tokens fracionários (ex: 1 token) calculam corretamente", () => {
    // 1 token input × $0.03/1k = $0.00003
    const result = calculateCost(1, 0, gpt4Pricing);
    expect(result.provider_cost).toBeCloseTo(0.00003, 8);
  });
});

// --------------------------------------------------------------------------
// usdToBrl
// --------------------------------------------------------------------------

describe("usdToBrl — conversão de moeda", () => {
  it("converte USD para BRL usando taxa padrão de 5.5", () => {
    expect(usdToBrl(1)).toBeCloseTo(5.5, 4);
  });

  it("converte USD para BRL usando taxa personalizada", () => {
    expect(usdToBrl(10, 6.0)).toBeCloseTo(60, 4);
  });

  it("zero dólares resulta em zero reais", () => {
    expect(usdToBrl(0)).toBe(0);
  });

  it("valores pequenos (microcustos) mantêm precisão", () => {
    expect(usdToBrl(0.001, 5.5)).toBeCloseTo(0.0055, 6);
  });
});

// --------------------------------------------------------------------------
// formatCost
// --------------------------------------------------------------------------

describe("formatCost — formatação de exibição", () => {
  it("formata USD com símbolo de dólar e 6 casas decimais", () => {
    expect(formatCost(0.000123, "USD")).toBe("$0.000123");
  });

  it("formata BRL com símbolo R$ e 4 casas decimais", () => {
    expect(formatCost(1.5, "BRL")).toBe("R$ 1.5000");
  });

  it("usa USD como padrão quando currency não fornecida", () => {
    expect(formatCost(0.5)).toBe("$0.500000");
  });

  it("formata zero corretamente em USD", () => {
    expect(formatCost(0, "USD")).toBe("$0.000000");
  });

  it("formata zero corretamente em BRL", () => {
    expect(formatCost(0, "BRL")).toBe("R$ 0.0000");
  });

  it("formata valores grandes (sem overflow de exibição)", () => {
    expect(formatCost(100.5, "USD")).toBe("$100.500000");
  });
});
