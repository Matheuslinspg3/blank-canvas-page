import type { ContractTemplateFormData } from "@/hooks/useContractTemplates";

export const DEFAULT_CONTRACT_TEMPLATES: (ContractTemplateFormData & { key: string })[] = [
  {
    key: "compra-venda-residencial",
    name: "Contrato de Compra e Venda - Residencial",
    description: "Modelo completo de contrato de compra e venda de imóvel residencial com cláusulas padrão.",
    contract_type: "venda",
    template_type: "html",
    variables: [
      "{{nome_cliente}}", "{{cpf_cliente}}", "{{email_cliente}}", "{{telefone_cliente}}",
      "{{titulo_imovel}}", "{{endereco_imovel}}", "{{codigo_imovel}}", "{{valor_contrato}}",
      "{{corretor_nome}}", "{{comissao}}", "{{nome_imobiliaria}}", "{{data_atual}}",
      "{{codigo_contrato}}", "{{data_inicio}}",
    ],
    body_html: `
<h1 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 8px;">CONTRATO PARTICULAR DE COMPRA E VENDA DE IMÓVEL</h1>
<p style="text-align: center; font-size: 12px; color: #666; margin-bottom: 24px;">Contrato nº {{codigo_contrato}}</p>

<p>Pelo presente instrumento particular, as partes abaixo qualificadas:</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">1. DAS PARTES</h2>

<p><strong>VENDEDOR(A):</strong> {{nome_imobiliaria}}, doravante denominado(a) simplesmente <strong>VENDEDOR(A)</strong>.</p>

<p><strong>COMPRADOR(A):</strong> {{nome_cliente}}, inscrito(a) no CPF sob nº {{cpf_cliente}}, e-mail {{email_cliente}}, telefone {{telefone_cliente}}, doravante denominado(a) simplesmente <strong>COMPRADOR(A)</strong>.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">2. DO OBJETO</h2>

<p>O presente contrato tem como objeto a compra e venda do imóvel identificado como <strong>{{titulo_imovel}}</strong>, código {{codigo_imovel}}, localizado em {{endereco_imovel}}, com todas as suas benfeitorias, acessões e pertenças.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">3. DO PREÇO E FORMA DE PAGAMENTO</h2>

<p>O preço total da venda é de <strong>{{valor_contrato}}</strong> (por extenso), a ser pago conforme condições acordadas entre as partes.</p>

<p><strong>Parágrafo Único:</strong> O pagamento será efetuado mediante depósito bancário, transferência eletrônica ou outra forma acordada entre as partes, devendo o comprador apresentar os respectivos comprovantes.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">4. DA TRANSFERÊNCIA E POSSE</h2>

<p>A posse do imóvel será transferida ao COMPRADOR(A) após a quitação integral do preço e a lavratura da escritura pública de compra e venda, a partir de {{data_inicio}}.</p>

<p><strong>Parágrafo Primeiro:</strong> As despesas com escritura, registro e ITBI (Imposto sobre Transmissão de Bens Imóveis) correrão por conta do COMPRADOR(A).</p>

<p><strong>Parágrafo Segundo:</strong> O VENDEDOR(A) se obriga a entregar o imóvel livre e desembaraçado de quaisquer ônus, dívidas, hipotecas ou gravames.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">5. DA COMISSÃO DE CORRETAGEM</h2>

<p>A comissão de corretagem, no percentual de <strong>{{comissao}}</strong> sobre o valor da venda, será devida ao corretor(a) <strong>{{corretor_nome}}</strong>, sendo paga pelo VENDEDOR(A) na data da assinatura do contrato definitivo.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">6. DAS OBRIGAÇÕES DO VENDEDOR(A)</h2>

<p>O VENDEDOR(A) se compromete a:</p>
<ul>
  <li>Apresentar toda a documentação necessária à escrituração;</li>
  <li>Manter o imóvel em boas condições até a entrega;</li>
  <li>Responder por eventuais vícios ocultos pelo prazo legal;</li>
  <li>Arcar com todas as despesas do imóvel até a efetiva transferência.</li>
</ul>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">7. DAS OBRIGAÇÕES DO COMPRADOR(A)</h2>

<p>O COMPRADOR(A) se compromete a:</p>
<ul>
  <li>Efetuar o pagamento nos prazos estipulados;</li>
  <li>Arcar com as despesas de transferência (escritura, registro, ITBI);</li>
  <li>Providenciar a documentação necessária para a escrituração.</li>
</ul>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">8. DA RESCISÃO E MULTA</h2>

<p>Em caso de desistência ou inadimplemento por parte do COMPRADOR(A), será retido o percentual de 20% (vinte por cento) do valor já pago, a título de cláusula penal, sendo o restante devolvido em até 30 (trinta) dias.</p>

<p>Em caso de desistência por parte do VENDEDOR(A), este deverá devolver ao COMPRADOR(A) todos os valores recebidos, acrescidos de multa de 20% (vinte por cento) sobre o montante pago.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">9. DO FORO</h2>

<p>As partes elegem o foro da comarca de localização do imóvel para dirimir quaisquer questões oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.</p>

<p style="margin-top: 24px;">E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença de 2 (duas) testemunhas.</p>

<p style="margin-top: 16px;">Local e data: __________________, {{data_atual}}</p>
`,
  },
  {
    key: "locacao-residencial",
    name: "Contrato de Locação Residencial",
    description: "Modelo de contrato de locação residencial com cláusulas de garantia, reajuste e vistoria.",
    contract_type: "locacao",
    template_type: "html",
    variables: [
      "{{nome_cliente}}", "{{cpf_cliente}}", "{{email_cliente}}", "{{telefone_cliente}}",
      "{{titulo_imovel}}", "{{endereco_imovel}}", "{{codigo_imovel}}", "{{valor_contrato}}",
      "{{data_inicio}}", "{{data_fim}}", "{{dia_pagamento}}", "{{indice_reajuste}}",
      "{{corretor_nome}}", "{{comissao}}", "{{nome_imobiliaria}}", "{{data_atual}}",
      "{{codigo_contrato}}",
    ],
    body_html: `
<h1 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 8px;">CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL</h1>
<p style="text-align: center; font-size: 12px; color: #666; margin-bottom: 24px;">Contrato nº {{codigo_contrato}}</p>

<p>Pelo presente instrumento particular de locação, as partes abaixo qualificadas têm entre si justo e contratado o seguinte:</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">1. DAS PARTES</h2>

<p><strong>LOCADOR(A):</strong> {{nome_imobiliaria}}, doravante denominado(a) simplesmente <strong>LOCADOR(A)</strong>.</p>

<p><strong>LOCATÁRIO(A):</strong> {{nome_cliente}}, inscrito(a) no CPF sob nº {{cpf_cliente}}, e-mail {{email_cliente}}, telefone {{telefone_cliente}}, doravante denominado(a) simplesmente <strong>LOCATÁRIO(A)</strong>.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">2. DO OBJETO</h2>

<p>O presente contrato tem como objeto a locação do imóvel identificado como <strong>{{titulo_imovel}}</strong>, código {{codigo_imovel}}, localizado em {{endereco_imovel}}, destinado exclusivamente para fins residenciais.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">3. DO PRAZO</h2>

<p>A locação vigorará pelo período de {{data_inicio}} a {{data_fim}}, podendo ser prorrogada por acordo entre as partes nos termos da Lei nº 8.245/91 (Lei do Inquilinato).</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">4. DO ALUGUEL E PAGAMENTO</h2>

<p>O aluguel mensal é de <strong>{{valor_contrato}}</strong>, com vencimento todo dia <strong>{{dia_pagamento}}</strong> de cada mês.</p>

<p><strong>Parágrafo Primeiro:</strong> O atraso no pagamento do aluguel acarretará multa de 10% (dez por cento) sobre o valor devido, acrescido de juros de mora de 1% (um por cento) ao mês, calculados pro rata die.</p>

<p><strong>Parágrafo Segundo:</strong> As despesas de condomínio, IPTU e contas de consumo (água, luz, gás) serão de responsabilidade do LOCATÁRIO(A).</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">5. DO REAJUSTE</h2>

<p>O valor do aluguel será reajustado anualmente pelo índice <strong>{{indice_reajuste}}</strong>, ou outro índice que venha a substituí-lo, sempre na data de aniversário do contrato.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">6. DA GARANTIA</h2>

<p>Como garantia do fiel cumprimento das obrigações contratuais, o LOCATÁRIO(A) apresentará uma das seguintes modalidades, conforme acordo: caução em dinheiro equivalente a 3 (três) meses de aluguel, seguro-fiança ou fiador idôneo.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">7. DA VISTORIA</h2>

<p>As partes realizarão vistoria de entrada e saída do imóvel, documentando as condições em laudo assinado por ambos. O LOCATÁRIO(A) se obriga a devolver o imóvel nas mesmas condições em que o recebeu, salvo desgaste natural pelo uso.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">8. DAS OBRIGAÇÕES DO LOCATÁRIO(A)</h2>

<p>O LOCATÁRIO(A) se compromete a:</p>
<ul>
  <li>Utilizar o imóvel exclusivamente para fins residenciais;</li>
  <li>Zelar pela conservação do imóvel e suas instalações;</li>
  <li>Não realizar modificações estruturais sem autorização prévia e por escrito do LOCADOR(A);</li>
  <li>Permitir a vistoria do imóvel pelo LOCADOR(A) mediante agendamento prévio;</li>
  <li>Comunicar ao LOCADOR(A) qualquer dano ou necessidade de reparo.</li>
</ul>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">9. DA RESCISÃO</h2>

<p>Em caso de rescisão antecipada pelo LOCATÁRIO(A), será devida multa proporcional ao período restante, calculada sobre 3 (três) meses de aluguel vigente, conforme art. 4º da Lei 8.245/91.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">10. DA ADMINISTRAÇÃO</h2>

<p>A administração do presente contrato ficará a cargo de <strong>{{corretor_nome}}</strong>, com comissão de <strong>{{comissao}}</strong> sobre o valor do aluguel mensal.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">11. DO FORO</h2>

<p>As partes elegem o foro da comarca de localização do imóvel para dirimir quaisquer questões oriundas deste contrato.</p>

<p style="margin-top: 24px;">E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença de 2 (duas) testemunhas.</p>

<p style="margin-top: 16px;">Local e data: __________________, {{data_atual}}</p>
`,
  },
  {
    key: "locacao-comercial",
    name: "Contrato de Locação Comercial",
    description: "Modelo de contrato de locação para fins comerciais com cláusulas específicas de uso comercial.",
    contract_type: "locacao",
    template_type: "html",
    variables: [
      "{{nome_cliente}}", "{{cpf_cliente}}", "{{email_cliente}}", "{{telefone_cliente}}",
      "{{titulo_imovel}}", "{{endereco_imovel}}", "{{codigo_imovel}}", "{{valor_contrato}}",
      "{{data_inicio}}", "{{data_fim}}", "{{dia_pagamento}}", "{{indice_reajuste}}",
      "{{corretor_nome}}", "{{comissao}}", "{{nome_imobiliaria}}", "{{data_atual}}",
      "{{codigo_contrato}}",
    ],
    body_html: `
<h1 style="text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 8px;">CONTRATO DE LOCAÇÃO COMERCIAL</h1>
<p style="text-align: center; font-size: 12px; color: #666; margin-bottom: 24px;">Contrato nº {{codigo_contrato}}</p>

<p>Pelo presente instrumento particular, as partes abaixo qualificadas:</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">1. DAS PARTES</h2>

<p><strong>LOCADOR(A):</strong> {{nome_imobiliaria}}, doravante denominado(a) <strong>LOCADOR(A)</strong>.</p>

<p><strong>LOCATÁRIO(A):</strong> {{nome_cliente}}, CPF/CNPJ {{cpf_cliente}}, e-mail {{email_cliente}}, telefone {{telefone_cliente}}, doravante denominado(a) <strong>LOCATÁRIO(A)</strong>.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">2. DO OBJETO</h2>

<p>Constitui objeto deste contrato a locação do imóvel comercial <strong>{{titulo_imovel}}</strong>, código {{codigo_imovel}}, situado em {{endereco_imovel}}, destinado exclusivamente para atividades comerciais.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">3. DO PRAZO</h2>

<p>O prazo da locação será de {{data_inicio}} a {{data_fim}}, assegurado ao LOCATÁRIO(A) o direito à renovação compulsória nos termos dos artigos 51 a 57 da Lei 8.245/91, desde que preenchidos os requisitos legais.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">4. DO ALUGUEL</h2>

<p>O aluguel mensal será de <strong>{{valor_contrato}}</strong>, com vencimento no dia <strong>{{dia_pagamento}}</strong> de cada mês, reajustado anualmente pelo índice <strong>{{indice_reajuste}}</strong>.</p>

<p><strong>Parágrafo Único:</strong> Além do aluguel, o LOCATÁRIO(A) arcará com todas as despesas de condomínio, IPTU, taxas, seguros e encargos incidentes sobre o imóvel durante a vigência contratual.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">5. DA GARANTIA</h2>

<p>Como garantia locatícia, o LOCATÁRIO(A) oferecerá caução equivalente a 3 (três) meses de aluguel ou seguro-fiança.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">6. DAS BENFEITORIAS</h2>

<p>As benfeitorias necessárias realizadas pelo LOCATÁRIO(A) serão indenizáveis. As benfeitorias úteis, somente se autorizadas previamente por escrito. As benfeitorias voluptuárias não serão indenizáveis, podendo ser retiradas sem danos ao imóvel.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">7. DA RESCISÃO</h2>

<p>A rescisão antecipada por qualquer das partes exigirá aviso prévio de 90 (noventa) dias, sob pena de multa equivalente a 3 (três) aluguéis vigentes.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">8. DA ADMINISTRAÇÃO</h2>

<p>A administração fica a cargo de <strong>{{corretor_nome}}</strong>, com comissão de <strong>{{comissao}}</strong>.</p>

<h2 style="font-size: 14px; font-weight: bold; margin-top: 20px;">9. DO FORO</h2>

<p>Fica eleito o foro da comarca de localização do imóvel.</p>

<p style="margin-top: 24px;">E por estarem de acordo, assinam em 2 (duas) vias de igual teor.</p>

<p style="margin-top: 16px;">Local e data: __________________, {{data_atual}}</p>
`,
  },
];
