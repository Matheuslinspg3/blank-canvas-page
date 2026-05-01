
# Plano: Extração de Hyperlinks Embutidos em PDFs no N8N

## Problema

O workflow N8N (`isnDEmqhzJVkI5PX`) usa o nó `Extract from File` que extrai apenas **texto visível** do PDF. URLs como `https://drive.google.com/...` escritas no texto são capturadas via regex, mas **hyperlinks embutidos** (ex: texto "CLIQUE AQUI E VEJA FOTOS" com link escondido) são perdidos.

A Edge Function `extract-property-pdf` já resolve isso com `pdf-lib` (funções `extractHyperlinksFromPdf` e `filterPhotoLinks`), mas o N8N opera em um fluxo separado e não tem acesso a essa lógica.

## Solução

Criar uma **Edge Function leve** (`extract-pdf-links`) que recebe o PDF via URL, extrai hyperlinks das annotations usando `pdf-lib`, e retorna os links. O workflow N8N chama essa função entre o download e a pré-formatação.

### Etapa 1: Nova Edge Function `extract-pdf-links`

- Recebe `{ signed_url: string }` via POST
- Baixa o PDF, carrega com `pdf-lib`
- Reutiliza a lógica de `extractHyperlinksFromPdf` e `filterPhotoLinks` já existente em `extract-property-pdf`
- Retorna `{ all_links: [{page, url}], photo_links: [{page, url}], text_urls_only: boolean }`
- Autenticação via `X-Webhook-Secret` (mesmo padrão N8N)

### Etapa 2: Atualizar Workflow N8N

Adicionar dois elementos ao fluxo ativo (PDF Webhook → Download PDF → ...):

1. **Novo nó HTTP Request** ("Extrair Hyperlinks") entre "Download PDF" e "Extrair Texto do PDF":
   - POST para `{supabase_url}/functions/v1/extract-pdf-links`
   - Envia `signed_url` do PDF
   - Headers: `X-Webhook-Secret`

2. **Atualizar nó "Pré-Formatação Inteligente"** para:
   - Receber os hyperlinks extraídos da Edge Function
   - Comparar URLs do texto visível vs hyperlinks embutidos
   - Consolidar em uma seção única `=== URLs CONSOLIDADAS ===` no prompt
   - Adicionar aviso quando hyperlinks existem mas URLs visíveis no texto não
   - Reportar estatísticas: `X URLs no texto, Y hyperlinks embutidos, Z únicos após consolidação`

### Etapa 3: Diagnóstico no resultado

O nó de pré-formatação incluirá no output:
- `links_report.text_urls`: quantidade de URLs encontradas no texto
- `links_report.embedded_links`: quantidade de hyperlinks embutidos
- `links_report.consolidated`: lista final de URLs únicas
- `links_report.warning`: mensagem quando não há URLs clicáveis extraíveis

## Fluxo atualizado

```text
PDF Webhook
  → Download PDF
  → [Extrair Hyperlinks (novo HTTP Request)]
  → Extrair Texto do PDF
  → Pré-Formatação Inteligente (atualizado - merge dos dois)
  → Chamar IA (Gemini)
  → Parsear Resposta
  → Callback
```

## Detalhes Técnicos

### Edge Function `extract-pdf-links`

```
POST /functions/v1/extract-pdf-links
Headers: X-Webhook-Secret: {secret}
Body: { "signed_url": "https://..." }
Response: {
  "all_links": [{ "page": 1, "url": "https://drive.google.com/..." }],
  "photo_links": [{ "page": 1, "url": "https://drive.google.com/..." }],
  "has_embedded_links": true,
  "total_embedded": 5,
  "total_photo": 3
}
```

### Conexão N8N

O nó "Download PDF" já salva o binário em `pdf_data`. Porém, como o N8N v2.15 não permite usar `pdf-lib` no Code Node (sandbox), precisamos delegar para a Edge Function. O nó "Extrair Hyperlinks" usará a `signed_url` original do webhook body (já disponível em `$('PDF Webhook').first().json.body.signed_url`).

### Arquivos alterados

1. `supabase/functions/extract-pdf-links/index.ts` (novo)
2. Workflow N8N `isnDEmqhzJVkI5PX` (atualizado via MCP)
3. Deploy da nova Edge Function

### Testes

- PDF com hyperlinks embutidos (ex: LEC com "CLIQUE AQUI"): deve extrair links do Drive
- PDF sem hyperlinks (ex: MARANATA): deve reportar `has_embedded_links: false`
- PDF com URLs visíveis no texto: deve consolidar ambas as fontes sem duplicatas
