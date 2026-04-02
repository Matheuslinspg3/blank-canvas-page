

## Contextualizar a mensagem do WhatsApp no Marketplace

### Problema
Quando o usuário clica em "WhatsApp" no diálogo de contato do Marketplace, a mensagem pré-preenchida é genérica. A IA do outro lado não sabe de qual imobiliária veio o contato, qual imóvel interessa, nem que a origem é o Porta do Corretor.

### Solução
Enriquecer a mensagem pré-preenchida do `wa.me` com todas as informações relevantes, de forma que a IA receba o contexto já na primeira mensagem do cliente — sem precisar de system message.

### Mudança

**Arquivo:** `src/components/marketplace/ContactDialog.tsx`

Atualizar a função `openWhatsApp` para montar uma mensagem rica com:
- Origem: "Porta do Corretor"
- Nome da imobiliária (`contactData.org_name`)
- Título do imóvel (`property.title`)
- Código externo se disponível (`property.external_code`)
- Bairro/cidade (`property.address_neighborhood`, `property.address_city`)
- Tipo de transação e preço
- Tipo de contato (corretor vs imobiliária)

Exemplo de mensagem gerada:
```
Olá! Encontrei o imóvel "Casa na Praia" (Cód: ABC123) no Porta do Corretor, anunciado pela imobiliária Costa Azul Imóveis, localizado em Praia Grande - Santos/SP. Gostaria de mais informações sobre este imóvel.
```

### Detalhe técnico
- A função `openWhatsApp` já recebe `phone` como parâmetro. Adicionamos um segundo parâmetro opcional `contactType: 'broker' | 'org'` para diferenciar se está falando com o corretor ou a imobiliária.
- Monta a mensagem dinamicamente usando dados já disponíveis em `property` e `contactData`.
- Formata o preço usando `Intl.NumberFormat` para moeda brasileira.

