import jsPDF from "jspdf";
import { FinancingProcess, BANK_COLORS } from "./types";

function fmtBRL(v: number) {
  return v ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ -";
}

function fmtDate(d?: string) {
  if (!d) return "____/____/________";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

function safeName(name: string) {
  const s = (name || "").trim().replace(/\s+/g, "_").replace(/[^\w\-.]/g, "");
  return s || "cliente_avulso";
}

function fmtCPF(cpf: string) {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11) return cpf || "___.___.___-__";
  return `${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9)}`;
}

const MARITAL_LABELS: Record<string, string> = {
  solteiro: "Solteiro(a)",
  casado: "Casado(a)",
  divorciado: "Divorciado(a)",
  viuvo: "Viúvo(a)",
  uniao_estavel: "União Estável",
};

class FormBuilder {
  private doc: jsPDF;
  private y: number = 15;
  private bankColor: string;
  private bankName: string;
  private pageWidth = 210;
  private margin = 15;
  private contentWidth: number;

  constructor(bankCode: string) {
    this.doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const bank = BANK_COLORS[bankCode] || { primary: "#333333", name: bankCode };
    this.bankColor = bank.primary;
    this.bankName = bank.name;
    this.contentWidth = this.pageWidth - this.margin * 2;
  }

  private hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  header(title: string, subtitle?: string) {
    const [r, g, b] = this.hexToRgb(this.bankColor);
    this.doc.setFillColor(r, g, b);
    this.doc.rect(0, 0, this.pageWidth, 28, "F");

    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(16);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(this.bankName, this.margin, 12);

    this.doc.setFontSize(11);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(title, this.margin, 20);

    if (subtitle) {
      this.doc.setFontSize(8);
      this.doc.text(subtitle, this.margin, 25);
    }

    this.doc.setTextColor(0, 0, 0);
    this.y = 35;
    return this;
  }

  section(title: string) {
    if (this.y > 265) this.newPage();
    const [r, g, b] = this.hexToRgb(this.bankColor);
    this.doc.setFillColor(r, g, b);
    this.doc.rect(this.margin, this.y, this.contentWidth, 7, "F");
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "bold");
    this.doc.text(title.toUpperCase(), this.margin + 3, this.y + 5);
    this.doc.setTextColor(0, 0, 0);
    this.y += 10;
    return this;
  }

  field(label: string, value: string, width: number = this.contentWidth) {
    if (this.y > 275) this.newPage();
    this.doc.setFontSize(7);
    this.doc.setFont("helvetica", "normal");
    this.doc.setTextColor(100, 100, 100);
    this.doc.text(label, this.margin + (this.contentWidth - width), this.y);

    this.doc.setFontSize(9);
    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont("helvetica", "normal");
    const displayValue = value || "________________________________________";
    this.doc.text(displayValue, this.margin + (this.contentWidth - width), this.y + 4);

    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(
      this.margin + (this.contentWidth - width),
      this.y + 5.5,
      this.margin + (this.contentWidth - width) + width - 2,
      this.y + 5.5
    );
    this.y += 10;
    return this;
  }

  fieldRow(fields: { label: string; value: string }[]) {
    if (this.y > 275) this.newPage();
    const colWidth = this.contentWidth / fields.length;
    const startY = this.y;

    fields.forEach((f, i) => {
      const x = this.margin + i * colWidth;
      this.doc.setFontSize(7);
      this.doc.setFont("helvetica", "normal");
      this.doc.setTextColor(100, 100, 100);
      this.doc.text(f.label, x, startY);

      this.doc.setFontSize(9);
      this.doc.setTextColor(0, 0, 0);
      const val = f.value || "________________________";
      this.doc.text(val, x, startY + 4);

      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(x, startY + 5.5, x + colWidth - 4, startY + 5.5);
    });

    this.y = startY + 10;
    return this;
  }

  spacer(h: number = 5) {
    this.y += h;
    return this;
  }

  signatureLine(label: string) {
    if (this.y > 260) this.newPage();
    this.y += 15;
    this.doc.setDrawColor(0, 0, 0);
    this.doc.line(this.margin, this.y, this.margin + 80, this.y);
    this.doc.setFontSize(8);
    this.doc.setFont("helvetica", "normal");
    this.doc.text(label, this.margin, this.y + 4);
    this.y += 8;
    return this;
  }

  footer() {
    const today = new Date().toLocaleDateString("pt-BR");
    this.doc.setFontSize(7);
    this.doc.setTextColor(150, 150, 150);
    this.doc.text(
      `Documento gerado automaticamente em ${today} — Porta do Corretor`,
      this.margin,
      290
    );
    this.doc.text(
      "Este documento é uma proposta eletrônica e não substitui a documentação oficial do banco.",
      this.margin,
      293
    );
    return this;
  }

  newPage() {
    this.doc.addPage();
    this.y = 15;
    return this;
  }

  save(filename: string) {
    this.footer();
    this.doc.save(filename);
  }
}

// ── Form generators ──

function generateProposta(proc: FinancingProcess, bankCode: string) {
  const fb = new FormBuilder(bankCode);
  fb.header("PROPOSTA DE FINANCIAMENTO IMOBILIÁRIO", `Processo #${proc.id.slice(0, 8)}`);

  fb.section("1. Dados do Proponente");
  fb.fieldRow([
    { label: "Nome Completo", value: proc.clientName },
    { label: "CPF", value: fmtCPF(proc.clientCpf) },
  ]);
  fb.fieldRow([
    { label: "RG", value: proc.clientRg },
    { label: "Data de Nascimento", value: fmtDate(proc.clientBirthDate) },
  ]);
  fb.fieldRow([
    { label: "Nacionalidade", value: proc.clientNationality },
    { label: "Estado Civil", value: MARITAL_LABELS[proc.clientMaritalStatus] || proc.clientMaritalStatus },
  ]);
  fb.fieldRow([
    { label: "Telefone", value: proc.clientPhone },
    { label: "E-mail", value: proc.clientEmail },
  ]);
  fb.field("Endereço Residencial", proc.clientAddress);
  fb.fieldRow([
    { label: "Cidade", value: proc.clientCity },
    { label: "UF", value: proc.clientState },
    { label: "CEP", value: proc.clientCep },
  ]);
  fb.fieldRow([
    { label: "Profissão/Ocupação", value: proc.clientOccupation },
    { label: "Renda Mensal Bruta", value: fmtBRL(proc.clientMonthlyIncome) },
  ]);

  fb.section("2. Dados do Imóvel");
  fb.field("Endereço do Imóvel", proc.propertyAddress);
  fb.fieldRow([
    { label: "Cidade", value: proc.propertyCity },
    { label: "UF", value: proc.propertyState },
  ]);
  fb.field("Matrícula/Registro", proc.propertyRegistration);
  fb.field("Valor de Avaliação/Compra", fmtBRL(proc.propertyValue));

  fb.section("3. Dados do Financiamento");
  fb.fieldRow([
    { label: "Valor do Financiamento", value: fmtBRL(proc.financingValue) },
    { label: "Entrada", value: fmtBRL(proc.downPayment) },
  ]);
  fb.fieldRow([
    { label: "Prazo (meses)", value: proc.financingTermMonths ? String(proc.financingTermMonths) : "" },
    { label: "Utiliza FGTS", value: proc.useFgts ? "Sim" : "Não" },
  ]);

  fb.spacer(10);
  fb.section("4. Declaração e Assinatura");
  fb.spacer(3);
  fb.signatureLine("Assinatura do Proponente");
  fb.signatureLine("Assinatura do Correspondente Bancário");

  fb.save(`proposta_${bankCode}_${safeName(proc.clientName)}.pdf`);
}

function generateDPS(proc: FinancingProcess, bankCode: string) {
  const fb = new FormBuilder(bankCode);
  fb.header("DECLARAÇÃO PESSOAL DE SAÚDE - DPS", "Seguro Habitacional");

  fb.section("Identificação do Proponente");
  fb.fieldRow([
    { label: "Nome Completo", value: proc.clientName },
    { label: "CPF", value: fmtCPF(proc.clientCpf) },
  ]);
  fb.fieldRow([
    { label: "Data de Nascimento", value: fmtDate(proc.clientBirthDate) },
    { label: "Telefone", value: proc.clientPhone },
  ]);

  fb.section("Questionário de Saúde");
  const questions = [
    "1. Encontra-se em perfeito estado de saúde?",
    "2. Está em tratamento médico ou faz uso contínuo de medicação?",
    "3. Já foi submetido(a) a alguma cirurgia?",
    "4. Possui alguma doença crônica diagnosticada?",
    "5. Já esteve internado(a) nos últimos 5 anos?",
    "6. Possui alguma deficiência física?",
    "7. É fumante ou consumidor regular de bebidas alcoólicas?",
    "8. Pratica atividades de risco (esportes radicais, etc.)?",
  ];

  questions.forEach((q) => {
    fb.fieldRow([
      { label: q, value: "" },
      { label: "( ) Sim  ( ) Não", value: "" },
    ]);
  });

  fb.spacer(5);
  fb.field("Observações", "");
  fb.spacer(10);

  fb.section("Declaração e Assinatura");
  fb.spacer(3);
  fb.signatureLine("Assinatura do Proponente");

  fb.save(`dps_${bankCode}_${safeName(proc.clientName)}.pdf`);
}

function generateFGTS(proc: FinancingProcess) {
  const fb = new FormBuilder("caixa");
  fb.header("AUTORIZAÇÃO PARA MOVIMENTAÇÃO DE FGTS", "Utilização do FGTS na aquisição de imóvel residencial");

  fb.section("Dados do Trabalhador");
  fb.fieldRow([
    { label: "Nome Completo", value: proc.clientName },
    { label: "CPF", value: fmtCPF(proc.clientCpf) },
  ]);
  fb.fieldRow([
    { label: "RG", value: proc.clientRg },
    { label: "Data de Nascimento", value: fmtDate(proc.clientBirthDate) },
  ]);
  fb.field("Endereço Atual", proc.clientAddress);
  fb.fieldRow([
    { label: "Cidade", value: proc.clientCity },
    { label: "UF", value: proc.clientState },
  ]);

  fb.section("Dados do Imóvel a Adquirir");
  fb.field("Endereço do Imóvel", proc.propertyAddress);
  fb.fieldRow([
    { label: "Cidade", value: proc.propertyCity },
    { label: "UF", value: proc.propertyState },
  ]);
  fb.field("Matrícula", proc.propertyRegistration);
  fb.field("Valor do Imóvel", fmtBRL(proc.propertyValue));

  fb.section("Declaração");
  fb.spacer(2);
  fb.field("", "Declaro que não sou proprietário de imóvel residencial no município onde trabalho ou resido,");
  fb.field("", "nem em município limítrofe ou integrante da mesma região metropolitana.");

  fb.spacer(10);
  fb.signatureLine("Assinatura do Trabalhador");

  fb.save(`fgts_caixa_${safeName(proc.clientName)}.pdf`);
}

function generateFichaCadastral(proc: FinancingProcess, bankCode: string) {
  const fb = new FormBuilder(bankCode);
  fb.header("FICHA CADASTRAL DO PROPONENTE", "Crédito Imobiliário");

  fb.section("Dados Pessoais");
  fb.field("Nome Completo", proc.clientName);
  fb.fieldRow([
    { label: "CPF", value: fmtCPF(proc.clientCpf) },
    { label: "RG", value: proc.clientRg },
  ]);
  fb.fieldRow([
    { label: "Data de Nascimento", value: fmtDate(proc.clientBirthDate) },
    { label: "Nacionalidade", value: proc.clientNationality },
  ]);
  fb.fieldRow([
    { label: "Estado Civil", value: MARITAL_LABELS[proc.clientMaritalStatus] || "" },
    { label: "E-mail", value: proc.clientEmail },
  ]);
  fb.fieldRow([
    { label: "Telefone", value: proc.clientPhone },
    { label: "Celular", value: proc.clientPhone },
  ]);

  fb.section("Endereço Residencial");
  fb.field("Endereço", proc.clientAddress);
  fb.fieldRow([
    { label: "Cidade", value: proc.clientCity },
    { label: "UF", value: proc.clientState },
    { label: "CEP", value: proc.clientCep },
  ]);

  fb.section("Dados Profissionais");
  fb.fieldRow([
    { label: "Profissão", value: proc.clientOccupation },
    { label: "Renda Mensal", value: fmtBRL(proc.clientMonthlyIncome) },
  ]);
  fb.field("Empresa / Empregador", "");
  fb.field("CNPJ do Empregador", "");
  fb.field("Endereço Comercial", "");

  fb.section("Referências Bancárias");
  fb.fieldRow([
    { label: "Banco", value: "" },
    { label: "Agência", value: "" },
    { label: "Conta", value: "" },
  ]);

  fb.spacer(10);
  fb.signatureLine("Assinatura do Proponente");

  fb.save(`ficha_cadastral_${bankCode}_${safeName(proc.clientName)}.pdf`);
}

// ── Main export ──

export function generateBankForm(proc: FinancingProcess, formId: string) {
  const bankCode = formId.split("_")[0];

  switch (formId) {
    case "caixa_proposta":
    case "bb_proposta":
    case "itau_proposta":
    case "santander_proposta":
    case "bradesco_proposta":
      generateProposta(proc, bankCode);
      break;
    case "caixa_saude":
    case "bb_saude":
    case "bradesco_saude":
      generateDPS(proc, bankCode);
      break;
    case "caixa_fgts":
      generateFGTS(proc);
      break;
    case "itau_ficha":
      generateFichaCadastral(proc, "itau");
      break;
    case "santander_declaracao":
      generateFichaCadastral(proc, "santander");
      break;
    default:
      generateProposta(proc, bankCode);
  }
}
