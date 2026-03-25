import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfUrl, totalPages } = await req.json();

    if (!pdfUrl) {
      return new Response(JSON.stringify({ error: "pdfUrl is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to analyze the PDF and suggest field positions
    // For now, return common field positions based on typical Brazilian contract layouts
    const fields = generateDefaultFieldPositions(totalPages || 1);

    return new Response(JSON.stringify({ fields }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error detecting PDF fields:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateDefaultFieldPositions(totalPages: number) {
  const fields: any[] = [];
  let id = 1;

  const makeId = () => `ai_${Date.now()}_${id++}`;

  // Page 1: Usually has the header with parties info
  // Client info - typically in the first third of the page
  fields.push(
    { id: makeId(), variable: "{{nome_cliente}}", label: "Nome do Cliente", page: 0, x: 15, y: 18, width: 35, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{cpf_cliente}}", label: "CPF/CNPJ", page: 0, x: 55, y: 18, width: 25, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{endereco_cliente}}", label: "Endereço do Cliente", page: 0, x: 15, y: 22, width: 65, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{rg_cliente}}", label: "RG", page: 0, x: 15, y: 26, width: 20, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{nacionalidade_cliente}}", label: "Nacionalidade", page: 0, x: 38, y: 26, width: 20, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{estado_civil_cliente}}", label: "Estado Civil", page: 0, x: 62, y: 26, width: 18, height: 2.5, fontSize: 10 },
  );

  // Property info
  fields.push(
    { id: makeId(), variable: "{{titulo_imovel}}", label: "Título do Imóvel", page: 0, x: 15, y: 35, width: 45, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{endereco_imovel}}", label: "Endereço do Imóvel", page: 0, x: 15, y: 39, width: 65, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{codigo_imovel}}", label: "Código do Imóvel", page: 0, x: 15, y: 43, width: 20, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{matricula_imovel}}", label: "Matrícula", page: 0, x: 40, y: 43, width: 20, height: 2.5, fontSize: 10 },
  );

  // Contract details
  fields.push(
    { id: makeId(), variable: "{{valor_contrato}}", label: "Valor", page: 0, x: 15, y: 52, width: 25, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{data_inicio}}", label: "Data de Início", page: 0, x: 45, y: 52, width: 15, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{data_fim}}", label: "Data de Fim", page: 0, x: 65, y: 52, width: 15, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{dia_pagamento}}", label: "Dia de Pagamento", page: 0, x: 15, y: 56, width: 15, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{indice_reajuste}}", label: "Índice de Reajuste", page: 0, x: 35, y: 56, width: 15, height: 2.5, fontSize: 10 },
  );

  // Broker/org info
  fields.push(
    { id: makeId(), variable: "{{corretor_nome}}", label: "Nome do Corretor", page: 0, x: 15, y: 65, width: 30, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{corretor_creci}}", label: "CRECI", page: 0, x: 50, y: 65, width: 15, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{imobiliaria_nome}}", label: "Nome da Imobiliária", page: 0, x: 15, y: 69, width: 30, height: 2.5, fontSize: 10 },
  );

  // Signatures - last page or page 1 if single page
  const sigPage = Math.max(0, totalPages - 1);
  fields.push(
    { id: makeId(), variable: "{{data_atual}}", label: "Data Atual", page: sigPage, x: 15, y: 75, width: 20, height: 2.5, fontSize: 10 },
    { id: makeId(), variable: "{{assinatura_contratante}}", label: "Assinatura Contratante", page: sigPage, x: 10, y: 82, width: 35, height: 6, fontSize: 10 },
    { id: makeId(), variable: "{{assinatura_contratado}}", label: "Assinatura Contratado", page: sigPage, x: 55, y: 82, width: 35, height: 6, fontSize: 10 },
    { id: makeId(), variable: "{{assinatura_testemunha1}}", label: "Testemunha 1", page: sigPage, x: 10, y: 92, width: 35, height: 5, fontSize: 9 },
    { id: makeId(), variable: "{{assinatura_testemunha2}}", label: "Testemunha 2", page: sigPage, x: 55, y: 92, width: 35, height: 5, fontSize: 9 },
  );

  return fields;
}
