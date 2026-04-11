

# Correção do Pipeline PDF -- URL Undefined no n8n

## Problema
O node "Download PDF" no workflow n8n `isnDEmqhzJVkI5PX` usa a expressão `{{ $json.body.signed_url }}`, mas o webhook v2 do n8n coloca o payload diretamente em `$json` (sem wrapper `.body`). Resultado: `signed_url` é `undefined` e o download falha imediatamente.

Os 5 jobs criados ficam presos em `processing` eternamente porque o workflow falha antes de chegar ao callback.

## Correção

### 1. Atualizar o node "Download PDF" no workflow n8n
Mudar a URL de `{{ $json.body.signed_url }}` para `{{ $json.signed_url }}`.

Verificar também se outros nodes referenciam `$json.body.*` e corrigir para `$json.*`:
- `Pré-Formatação Inteligente`: verificar referências a `$('PDF Webhook').first().json.body.job_id` etc.
- `Parsear Resposta da IA`: verificar referência ao `job_id`
- `Callback`: verificar a URL e body do callback

### 2. Limpar jobs órfãos
Atualizar os 5 jobs presos em `processing` para `failed` com mensagem explicativa, para não confundir o usuário.

### 3. Republicar o workflow

## Resultado Esperado
Após a correção, o webhook recebe o payload, o "Download PDF" acessa `$json.signed_url` corretamente, baixa o PDF, e o pipeline inteiro (Extract → Pré-Formatação → Gemini → Callback) executa com sucesso.

