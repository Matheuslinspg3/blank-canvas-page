

# Correção: `toBuffer is not a function` no n8n Code Node

## Problema Identificado
A execução real do workflow n8n (Execution #87064) falha no node **"Pré-Formatação Inteligente"** com o erro:

```
TypeError: downloadNode.binary.pdf_data.toBuffer is not a function [line 7]
```

O n8n 2.15.0 usa `filesystem-v2` para armazenamento binário. O método `.toBuffer()` não está disponível diretamente nos objetos binários acessados via `$('Node').first().binary`. Em vez disso, deve-se usar a helper function `$getWorkflowStaticData` ou, mais simplesmente, acessar o binário via `this.helpers.getBinaryDataBuffer()` -- mas no Code node v2 a forma correta é usar `await this.helpers.getBinaryDataBuffer(itemIndex, propertyName)` ou simplesmente passar o PDF via a signed URL diretamente para o Gemini ao invés de tentar converter para base64 in-memory.

**Consequência**: O workflow falha silenciosamente no n8n, não há callback, e os 3 jobs ficam presos em `processing` eternamente.

## Plano de Correção

### 1. Corrigir o Code node "Pré-Formatação Inteligente"
Atualizar o jsCode para usar a **signed URL** do webhook payload em vez de tentar converter binário para base64. O Gemini 2.0 Flash aceita `fileUri` além de `inlineData`, mas como a URL é temporária do Supabase Storage (não do Google), a melhor abordagem é:

- Usar `await $('Download PDF').first().binary.pdf_data.data` se o binário estiver em modo `base64` **OU**
- Re-baixar o PDF via `fetch()` usando a `signed_url` do body do webhook e converter para base64

A abordagem mais robusta: usar a signed_url do payload original (acessível via `$('PDF Webhook').first().json.body.signed_url`) para fazer fetch e converter para base64 diretamente no Code node, eliminando a dependência do sistema de binários do n8n.

**Código corrigido (linhas relevantes):**
```javascript
// Substituir:
const downloadNode = $('Download PDF').first();
const pdfBuffer = await downloadNode.binary.pdf_data.toBuffer();
const base64Pdf = pdfBuffer.toString('base64');

// Por:
const signedUrl = $('PDF Webhook').first().json.body.signed_url;
const pdfResponse = await fetch(signedUrl);
const pdfArrayBuffer = await pdfResponse.arrayBuffer();
const base64Pdf = Buffer.from(pdfArrayBuffer).toString('base64');
```

### 2. Marcar jobs órfãos como `failed`
Executar migração SQL para atualizar os 3 jobs presos em `processing`:
```sql
UPDATE pdf_extract_jobs 
SET status = 'failed', 
    error = 'Workflow n8n falhou: toBuffer não suportado (corrigido)',
    updated_at = now()
WHERE status = 'processing';
```

### 3. Testar com pin data e depois com execução real
- Atualizar o workflow via `update_workflow`
- Testar com `test_workflow` usando pin data
- Pedir ao usuário para testar upload real

## Detalhes Técnicos
- **Workflow**: `isnDEmqhzJVkI5PX`
- **Node afetado**: "Pré-Formatação Inteligente" (Code v2)
- **Erro raiz**: `filesystem-v2` binary storage no n8n 2.15.0 não expõe `.toBuffer()` no Code node
- **Execução de evidência**: #87064 (status: error)

