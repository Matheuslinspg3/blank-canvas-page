export interface PdfFieldPosition {
  id: string;
  variable: string;
  label: string;
  page: number; // 0-indexed
  x: number; // percentage from left (0-100)
  y: number; // percentage from top (0-100)
  width: number; // percentage
  height: number; // percentage
  fontSize: number; // in pt
}

export const AVAILABLE_PDF_FIELDS: { variable: string; label: string; category: string }[] = [
  // Lead / Client
  { variable: "{{nome_cliente}}", label: "Nome do Cliente", category: "Cliente" },
  { variable: "{{cpf_cliente}}", label: "CPF/CNPJ", category: "Cliente" },
  { variable: "{{email_cliente}}", label: "Email", category: "Cliente" },
  { variable: "{{telefone_cliente}}", label: "Telefone", category: "Cliente" },
  { variable: "{{rg_cliente}}", label: "RG", category: "Cliente" },
  { variable: "{{endereco_cliente}}", label: "Endereço do Cliente", category: "Cliente" },
  { variable: "{{nacionalidade_cliente}}", label: "Nacionalidade", category: "Cliente" },
  { variable: "{{estado_civil_cliente}}", label: "Estado Civil", category: "Cliente" },
  { variable: "{{profissao_cliente}}", label: "Profissão", category: "Cliente" },

  // Property
  { variable: "{{titulo_imovel}}", label: "Título do Imóvel", category: "Imóvel" },
  { variable: "{{codigo_imovel}}", label: "Código do Imóvel", category: "Imóvel" },
  { variable: "{{endereco_imovel}}", label: "Endereço do Imóvel", category: "Imóvel" },
  { variable: "{{tipo_imovel}}", label: "Tipo do Imóvel", category: "Imóvel" },
  { variable: "{{area_imovel}}", label: "Área (m²)", category: "Imóvel" },
  { variable: "{{quartos_imovel}}", label: "Quartos", category: "Imóvel" },
  { variable: "{{matricula_imovel}}", label: "Matrícula", category: "Imóvel" },

  // Contract
  { variable: "{{valor_contrato}}", label: "Valor", category: "Contrato" },
  { variable: "{{tipo_contrato}}", label: "Tipo de Contrato", category: "Contrato" },
  { variable: "{{data_inicio}}", label: "Data de Início", category: "Contrato" },
  { variable: "{{data_fim}}", label: "Data de Fim", category: "Contrato" },
  { variable: "{{dia_pagamento}}", label: "Dia de Pagamento", category: "Contrato" },
  { variable: "{{indice_reajuste}}", label: "Índice de Reajuste", category: "Contrato" },
  { variable: "{{comissao}}", label: "Comissão (%)", category: "Contrato" },
  { variable: "{{data_atual}}", label: "Data Atual", category: "Contrato" },

  // Broker / Organization
  { variable: "{{corretor_nome}}", label: "Nome do Corretor", category: "Corretor" },
  { variable: "{{corretor_creci}}", label: "CRECI", category: "Corretor" },
  { variable: "{{imobiliaria_nome}}", label: "Nome da Imobiliária", category: "Corretor" },
  { variable: "{{imobiliaria_cnpj}}", label: "CNPJ da Imobiliária", category: "Corretor" },
  { variable: "{{imobiliaria_endereco}}", label: "Endereço da Imobiliária", category: "Corretor" },

  // Signature
  { variable: "{{assinatura_contratante}}", label: "Assinatura Contratante", category: "Assinatura" },
  { variable: "{{assinatura_contratado}}", label: "Assinatura Contratado", category: "Assinatura" },
  { variable: "{{assinatura_testemunha1}}", label: "Testemunha 1", category: "Assinatura" },
  { variable: "{{assinatura_testemunha2}}", label: "Testemunha 2", category: "Assinatura" },
];
