

# Pipeline de Extração Máxima de PDF -- Versão Definitiva

## Resumo

Atualizar o workflow n8n `isnDEmqhzJVkI5PX` para usar um pipeline de 3 etapas: (1) extração técnica com o node nativo `Extract from File` do n8n, (2) pré-formatação inteligente dos dados para a IA, e (3) análise visual + cruzamento pelo Gemini com prompt otimizado.

## O Que Muda

### Problema Atual
O workflow atual envia o PDF binário direto para o Gemini sem nenhum pré-processamento. O Gemini "vê" o PDF como imagem e perde:
- Hyperlinks/URLs clicáveis (onde estão os links do Google Drive)
- Metadados do documento (autor, título, datas)
- Texto exato (depende do OCR visual, que é impreciso)

O callback usa a chave errada (`result` em vez de `extracted_data`) e `Boolean("false")` retorna `true`.

### Nova Arquitetura

```text
PDF Webhook
    │
    ▼
Download PDF (HTTP Request) ← já existe
    │
    ├──→ [Extract from File] (node nativo n8n, operation: pdf)
    │      → texto bruto + metadados do PDF
    │
    └──→ (PDF binário mantido para análise visual)
    │
    ▼
[Code] Pré-Formatação Inteligente
    → Extrai URLs via regex do texto
    → Separa links do Drive
    → Detecta palavras-chave (RESERVADO, VENDIDO)
    → Formata texto em blocos estruturados por página
    → Gera resumo de metadados
    → Monta prompt enriquecido com TUDO
    │
    ▼
[HTTP Request] Gemini com contexto duplo:
    → Texto pré-processado + metadados + links encontrados
    → PDF binário como inlineData (análise visual)
    │
    ▼
[Code] Parsear + Callback CORRETO
    → Chave "extracted_data" (não "result")
    → Boolean fix: val === true || val === 'true'
    │
    ▼
[HTTP Request] Callback → pdf-job-complete
```

## Sobre Formatação de Dados para a IA

Sim, o sistema pode e vai formatar os dados antes de enviar para a IA. O novo Code Node de "Pré-Formatação" fará:

1. **Limpeza de texto**: remove espaços duplicados, quebras de linha excessivas, caracteres especiais inúteis
2. **Estruturação por página**: separa o texto por página com marcadores claros (`=== PÁGINA 1 ===`)
3. **Extração prévia de URLs**: lista todas as URLs encontradas no texto antes da IA processar
4. **Detecção de padrões**: identifica previamente marcações como "RESERVADO", "VENDIDO", "DISPONÍVEL" no texto
5. **Contexto de metadados**: formata título, autor, data de criação, software criador em bloco separado
6. **Prompt estruturado**: em vez de "extraia tudo", envia um prompt com seções claras:

```
=== METADADOS DO DOCUMENTO ===
Título: ...
Autor: ...
Criado em: ...
Páginas: ...

=== URLs ENCONTRADAS NO TEXTO ===
1. https://drive.google.com/... (Drive)
2. https://example.com/...

=== DETECÇÕES AUTOMÁTICAS ===
- Página 3: contém "RESERVADO"
- Página 7: contém "VENDIDO"

=== TEXTO COMPLETO POR PÁGINA ===
--- Página 1 ---
[texto limpo]
--- Página 2 ---
[texto limpo]

=== INSTRUÇÃO ===
Analise visualmente o PDF anexo E o texto acima.
Cruze as URLs encontradas com os imóveis correspondentes.
Identifique visualmente marcações de RESERVADO/VENDIDO que podem ser selos gráficos.
Retorne JSON no schema especificado.
```

Isso dá à IA contexto máximo e estruturado, em vez de depender dela para "descobrir" tudo sozinha.

## Extrações Adicionais Incluídas

| Dado | Como | Node |
|------|------|------|
| Texto bruto | `Extract from File` (pdf) | Node nativo n8n |
| Metadados (título, autor, datas) | `Extract from File` (pdf) | Node nativo n8n |
| URLs/hyperlinks no texto | Regex no Code Node | Code |
| Links do Google Drive | Filtro específico | Code |
| Status textual (RESERVADO/VENDIDO) | Regex no texto | Code |
| Status visual (selos gráficos) | Gemini visual analysis | HTTP Request |
| Fotos e plantas | Gemini visual analysis | HTTP Request |
| Annotations/comentários | Gemini visual + texto | Combinado |
| Arquivos embutidos | Gemini inlineData | HTTP Request |
| OCR de páginas escaneadas | Gemini visual | HTTP Request |

## Mudanças Técnicas

### 1. Atualizar workflow n8n (isnDEmqhzJVkI5PX)
- **Adicionar** node `Extract from File` (operation: pdf) após Download
- **Adicionar** node Code "Pré-Formatação" que limpa, estrutura e formata os dados
- **Atualizar** node "Preparar Gemini" para montar prompt com contexto duplo (texto formatado + PDF binário)
- **Corrigir** node "Parsear Resposta" -- chave `extracted_data` + boolean fix
- **Publicar** workflow

### 2. Nenhuma mudança no código React/Supabase
As Edge Functions já estão corretas. O problema é 100% no workflow n8n.

