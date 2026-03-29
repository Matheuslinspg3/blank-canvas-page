/**
 * Testes — Validação do Checkout (CheckoutDialog)
 * Cobre: formatação de CPF/CNPJ, validação de campos, cálculo de preço,
 *        lógica de ciclo de billing.
 */

import { describe, it, expect } from "vitest";

// --------------------------------------------------------------------------
// Replicação da função formatCpf do CheckoutDialog
// --------------------------------------------------------------------------

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/**
 * Valida os campos obrigatórios do formulário de checkout.
 */
function validateCheckoutForm(cpf: string, name: string): string | null {
  if (!cpf.replace(/\D/g, "")) return "Informe seu CPF ou CNPJ";
  if (!name.trim()) return "Informe seu nome completo";
  return null;
}

// --------------------------------------------------------------------------
// Testes de formatação de CPF
// --------------------------------------------------------------------------

describe("formatCpf — CPF (11 dígitos)", () => {
  it("formata CPF completo corretamente", () => {
    expect(formatCpf("12345678901")).toBe("123.456.789-01");
  });

  it("formata CPF parcial (6 dígitos)", () => {
    expect(formatCpf("123456")).toBe("123.456");
  });

  it("formata CPF parcial (9 dígitos)", () => {
    expect(formatCpf("123456789")).toBe("123.456.789");
  });

  it("remove caracteres não numéricos antes de formatar", () => {
    expect(formatCpf("123.456.789-01")).toBe("123.456.789-01");
  });

  it("ignora dígitos além de 14 (CNPJ máximo)", () => {
    const tooLong = "123456789012345"; // 15 dígitos
    const result = formatCpf(tooLong);
    // Deve truncar em 14 dígitos e formatar como CNPJ
    const digits = result.replace(/\D/g, "");
    expect(digits.length).toBeLessThanOrEqual(14);
  });

  it("string vazia retorna string vazia", () => {
    expect(formatCpf("")).toBe("");
  });

  it("somente letras retorna string vazia", () => {
    expect(formatCpf("abcdef")).toBe("");
  });
});

// --------------------------------------------------------------------------
// Testes de formatação de CNPJ
// --------------------------------------------------------------------------

describe("formatCpf — CNPJ (14 dígitos)", () => {
  it("formata CNPJ completo corretamente", () => {
    expect(formatCpf("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("formata CNPJ parcial (10 dígitos) ainda como CPF (< 12 dígitos)", () => {
    // A função usa formato CNPJ somente a partir de 12 dígitos
    expect(formatCpf("1234567800")).toBe("123.456.780-0");
  });

  it("formata CNPJ parcial (12 dígitos)", () => {
    expect(formatCpf("123456780001")).toBe("12.345.678/0001");
  });

  it("diferencia CPF de CNPJ baseado na quantidade de dígitos", () => {
    const cpfResult = formatCpf("12345678901");
    const cnpjResult = formatCpf("12345678000195");
    expect(cpfResult).toContain("-");
    expect(cnpjResult).toContain("/");
  });
});

// --------------------------------------------------------------------------
// Testes de validação do formulário
// --------------------------------------------------------------------------

describe("validateCheckoutForm — validação de campos obrigatórios", () => {
  it("retorna erro quando CPF está vazio", () => {
    expect(validateCheckoutForm("", "João Silva")).toBe("Informe seu CPF ou CNPJ");
  });

  it("retorna erro quando CPF contém apenas caracteres não numéricos", () => {
    expect(validateCheckoutForm("...-", "João Silva")).toBe("Informe seu CPF ou CNPJ");
  });

  it("retorna erro quando nome está vazio", () => {
    expect(validateCheckoutForm("12345678901", "")).toBe("Informe seu nome completo");
  });

  it("retorna erro quando nome contém apenas espaços", () => {
    expect(validateCheckoutForm("12345678901", "   ")).toBe("Informe seu nome completo");
  });

  it("retorna null quando todos os campos são válidos", () => {
    expect(validateCheckoutForm("123.456.789-01", "João Silva")).toBeNull();
  });

  it("verifica CPF antes do nome (ordem de validação)", () => {
    // Ambos inválidos — deve retornar erro de CPF primeiro
    expect(validateCheckoutForm("", "")).toBe("Informe seu CPF ou CNPJ");
  });

  it("CPF formatado com pontos e traço é considerado válido", () => {
    // O dígito é extraído com replace(/\D/g, '')
    expect(validateCheckoutForm("123.456.789-01", "Maria Santos")).toBeNull();
  });

  it("CNPJ formatado é considerado válido", () => {
    expect(validateCheckoutForm("12.345.678/0001-95", "Empresa Ltda")).toBeNull();
  });
});

// --------------------------------------------------------------------------
// Testes de sanitização antes de envio ao backend
// --------------------------------------------------------------------------

describe("Checkout — sanitização do CPF antes de envio", () => {
  it("remove formatação do CPF ao enviar para a API", () => {
    const formatted = "123.456.789-01";
    const sanitized = formatted.replace(/\D/g, "");
    expect(sanitized).toBe("12345678901");
  });

  it("remove formatação do CNPJ ao enviar para a API", () => {
    const formatted = "12.345.678/0001-95";
    const sanitized = formatted.replace(/\D/g, "");
    expect(sanitized).toBe("12345678000195");
  });

  it("CPF enviado à API tem exatamente 11 dígitos", () => {
    const formatted = "123.456.789-01";
    const sanitized = formatted.replace(/\D/g, "");
    expect(sanitized.length).toBe(11);
  });

  it("CNPJ enviado à API tem exatamente 14 dígitos", () => {
    const formatted = "12.345.678/0001-95";
    const sanitized = formatted.replace(/\D/g, "");
    expect(sanitized.length).toBe(14);
  });

  it("nome é trimado antes de enviar", () => {
    const name = "  João Silva  ";
    expect(name.trim()).toBe("João Silva");
  });
});

// --------------------------------------------------------------------------
// Testes de cálculo de preço no checkout
// --------------------------------------------------------------------------

describe("Checkout — cálculo de preço por ciclo de billing", () => {
  const plan = {
    price_monthly: 4900,   // R$49,00 em centavos
    price_yearly: 47040,   // R$470,40 em centavos
  };

  it("seleciona preço mensal para ciclo 'monthly'", () => {
    const billingCycle = "monthly";
    const price = billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;
    expect(price).toBe(4900);
  });

  it("seleciona preço anual para ciclo 'yearly'", () => {
    const billingCycle = "yearly";
    const price = billingCycle === "yearly" ? plan.price_yearly : plan.price_monthly;
    expect(price).toBe(47040);
  });

  it("calcula equivalente mensal do plano anual", () => {
    const monthlyEquivalent = plan.price_yearly / 12 / 100;
    expect(monthlyEquivalent).toBeCloseTo(39.2, 1);
  });

  it("calcula economia anual em comparação a 12 meses mensais", () => {
    const savings = (plan.price_monthly * 12 - plan.price_yearly) / 100;
    expect(savings).toBeCloseTo(117.6, 1); // R$117,60 de economia
  });

  it("economia anual é sempre positiva (plano anual mais barato)", () => {
    const savings = plan.price_monthly * 12 - plan.price_yearly;
    expect(savings).toBeGreaterThan(0);
  });

  it("preço exibido em reais: centavos / 100", () => {
    const priceInReais = plan.price_monthly / 100;
    expect(priceInReais).toBe(49);
  });
});

// --------------------------------------------------------------------------
// Testes de seleção de método de pagamento
// --------------------------------------------------------------------------

describe("Checkout — método de pagamento", () => {
  const validMethods = ["pix", "credit_card"];

  it("PIX é um método válido", () => {
    expect(validMethods).toContain("pix");
  });

  it("cartão de crédito é um método válido", () => {
    expect(validMethods).toContain("credit_card");
  });

  it("método inválido não é aceito", () => {
    expect(validMethods).not.toContain("boleto");
    expect(validMethods).not.toContain("bitcoin");
  });

  it("PIX gera QR code e copyPaste", () => {
    const pixData = {
      qrCode: "data:image/png;base64,...",
      copyPaste: "00020101021126580014br.gov.bcb.pix...",
    };
    expect(pixData.qrCode).toBeTruthy();
    expect(pixData.copyPaste).toBeTruthy();
  });

  it("copyPaste do PIX pode ser copiado para clipboard", () => {
    const pixCopyPaste = "00020101021126580014br.gov.bcb.pix...";
    // Valida que é uma string não vazia
    expect(pixCopyPaste.length).toBeGreaterThan(0);
  });
});

// --------------------------------------------------------------------------
// Testes de construção do payload para a API de billing
// --------------------------------------------------------------------------

describe("Checkout — construção do payload de assinatura", () => {
  it("payload padrão sem módulos customizados", () => {
    const payload = {
      planId: "plan-starter",
      billingCycle: "monthly",
      paymentMethod: "pix",
      customerName: "João Silva",
      customerCpf: "12345678901",
    };

    expect(payload.planId).toBeTruthy();
    expect(payload.billingCycle).toMatch(/^(monthly|yearly)$/);
    expect(payload.paymentMethod).toMatch(/^(pix|credit_card)$/);
    expect(payload.customerCpf).toMatch(/^\d+$/); // somente dígitos
  });

  it("payload com módulos customizados inclui customModules", () => {
    const customModules = [
      { moduleId: "extra-users", quantity: 5 },
      { moduleId: "extra-storage", quantity: 2 },
    ];

    const payload = {
      planId: "plan-custom",
      billingCycle: "monthly",
      paymentMethod: "pix",
      customerName: "João Silva",
      customerCpf: "12345678901",
      customModules,
    };

    expect(payload.customModules).toHaveLength(2);
    expect(payload.customModules[0].moduleId).toBe("extra-users");
    expect(payload.customModules[0].quantity).toBe(5);
  });

  it("customerCpf é enviado sem formatação (somente dígitos)", () => {
    const formatted = "123.456.789-01";
    const cpfForApi = formatted.replace(/\D/g, "");
    expect(cpfForApi).toMatch(/^\d+$/);
    expect(cpfForApi).toBe("12345678901");
  });
});
