export interface FinancingProcess {
  id: string;
  clientName: string;
  clientPhone: string;
  clientCpf: string;
  clientRg: string;
  clientEmail: string;
  clientBirthDate: string;
  clientNationality: string;
  clientMaritalStatus: string;
  clientAddress: string;
  clientCity: string;
  clientState: string;
  clientCep: string;
  clientOccupation: string;
  clientMonthlyIncome: number;
  propertyValue: number;
  financingValue: number;
  propertyAddress: string;
  propertyCity: string;
  propertyState: string;
  propertyRegistration: string;
  bank: string;
  financingTermMonths: number;
  downPayment: number;
  useFgts: boolean;
  stage: string;
  createdAt: Date;
}

export const STAGES = [
  { id: "analise_credito", label: "Análise de Crédito", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  { id: "documentacao", label: "Documentação", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  { id: "avaliacao", label: "Avaliação", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  { id: "contrato", label: "Contrato", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400" },
  { id: "liberacao", label: "Liberação", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
];

export const BANK_FORMS: Record<string, { id: string; name: string; description: string }[]> = {
  caixa: [
    { id: "caixa_proposta", name: "Proposta de Financiamento", description: "Formulário principal de proposta de crédito imobiliário" },
    { id: "caixa_saude", name: "Declaração Pessoal de Saúde", description: "Declaração de saúde para seguro habitacional" },
    { id: "caixa_fgts", name: "Autorização de Consulta FGTS", description: "Autorização para consulta e movimentação do FGTS" },
  ],
  bb: [
    { id: "bb_proposta", name: "Proposta de Crédito Imobiliário", description: "Proposta de financiamento imobiliário BB" },
    { id: "bb_saude", name: "Declaração Pessoal de Saúde", description: "DPS para seguro habitacional" },
  ],
  itau: [
    { id: "itau_proposta", name: "Proposta de Financiamento", description: "Proposta de crédito imobiliário Itaú" },
    { id: "itau_ficha", name: "Ficha Cadastral", description: "Ficha cadastral completa do proponente" },
  ],
  santander: [
    { id: "santander_proposta", name: "Proposta de Financiamento", description: "Proposta de financiamento Santander" },
    { id: "santander_declaracao", name: "Declaração Pessoal", description: "Declaração pessoal do proponente" },
  ],
  bradesco: [
    { id: "bradesco_proposta", name: "Proposta de Financiamento", description: "Proposta de crédito imobiliário Bradesco" },
    { id: "bradesco_saude", name: "Declaração de Saúde", description: "DPS para seguro habitacional Bradesco" },
  ],
};

export const BANK_COLORS: Record<string, { primary: string; name: string }> = {
  caixa: { primary: "#005CA9", name: "Caixa Econômica Federal" },
  bb: { primary: "#FFCC00", name: "Banco do Brasil" },
  itau: { primary: "#FF6600", name: "Itaú Unibanco" },
  santander: { primary: "#CC0000", name: "Santander" },
  bradesco: { primary: "#CC092F", name: "Bradesco" },
};

export const EMPTY_FORM: Omit<FinancingProcess, "id" | "stage" | "createdAt"> = {
  clientName: "",
  clientPhone: "",
  clientCpf: "",
  clientRg: "",
  clientEmail: "",
  clientBirthDate: "",
  clientNationality: "Brasileira",
  clientMaritalStatus: "solteiro",
  clientAddress: "",
  clientCity: "",
  clientState: "SP",
  clientCep: "",
  clientOccupation: "",
  clientMonthlyIncome: 0,
  propertyValue: 0,
  financingValue: 0,
  propertyAddress: "",
  propertyCity: "",
  propertyState: "SP",
  propertyRegistration: "",
  bank: "caixa",
  financingTermMonths: 360,
  downPayment: 0,
  useFgts: false,
};
