

# Plano: Extrair links do Google Drive de PDFs importados

## Problema identificado

Quando o PDF contém links para pastas do Google Drive (como hyperlinks clicáveis), a IA não consegue extraí-los. Isso acontece porque os hyperlinks em PDF são **anotações de metadados** — a IA vê apenas o texto renderizado, não a URL de destino do link. Confirmado nos dados: todas as 5 extrações recentes têm `photos_url = null` para todos os imóveis.

## Solução

Extrair os hyperlinks do PDF **antes** de enviá-lo à IA, e incluir esses links no prompt para que a IA possa associá-los aos imóveis corretos.

## Etapas técnicas

### 1. Extrair hyperlinks do PDF na Edge Function `extract-property-pdf`

Antes de chamar o `ai-router`, percorrer as anotações do PDF usando `pdf-lib` para extrair todas as URLs encontradas (links do Google Drive, Dropbox, etc.). O `pdf-lib` permite acessar `page.node.Annots()` para ler anotações de tipo `/Link` com campo `/A` → `/URI`.

### 2. Incluir links extraídos no prompt da IA

Adicionar ao prompt uma seção com os links encontrados no PDF, pedindo à IA que associe cada link ao imóvel correspondente baseado no contexto da página/posição:

```
Links encontrados no PDF:
- Página 1: https://drive.google.com/drive/folders/abc123
- Página 2: https://drive.google.com/drive/folders/def456
...

Associe cada link ao imóvel correspondente no campo "photos_url".
```

### 3. Fallback: link único compartilhado

Se o PDF contiver apenas 1 link de Drive (pasta raiz com subpastas por imóvel), o prompt já instrui a IA a repetir esse link para todos os imóveis. O sistema existente de subpastas (`subfolderMatchMap`) já faz o mapeamento automático por nome.

## Arquivos modificados

- `supabase/functions/extract-property-pdf/index.ts` — adicionar extração de hyperlinks via pdf-lib e enriquecer o prompt com os links encontrados

## Impacto

- Sem mudanças no frontend (o fluxo de `photos_url` → `scrapeAndSavePhotoRefs` já existe e funciona)
- Sem mudanças no banco de dados
- A extração de links é rápida e não impacta performance

