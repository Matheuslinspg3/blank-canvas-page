# Plan: Criar com IA para Site Builder v2

## Resumo
Atualizar o fluxo "Criar com IA" para oferecer duas opções:
1. **Só textos** — preenche conteúdo nos templates existentes (atual, adaptado para v2)
2. **Site completo** — IA escolhe seções, monta layout e preenche tudo com dados reais

## Arquitetura

### Edge Function: `generate-site-v2`
- Recebe: `organization_id`, `mode` ("text_only" | "full_layout"), respostas do questionário (público-alvo, tom, diferenciais, região)
- Busca dados reais: `brand_settings`, `website_settings`, `properties` (top 12), nome/slug da org
- Monta prompt contextualizado com inventário real
- Usa Lovable AI (gemini-3-flash-preview) com tool calling para extrair JSON estruturado
- Retorna: `SiteLayoutV2` completo (seções, rows, colunas, elementos com props preenchidos)

### Schema de saída (tool calling)
A IA retorna um JSON que mapeia diretamente para `SiteLayoutV2`:
- Lista de seções com template_id (hero-split, about-with-image, etc.)
- Props dos elementos preenchidos (títulos, textos, CTAs, cores do branding)
- Dados de imóveis reais injetados nos property_list/carousel

### Frontend
1. Atualizar `AIContentDialog` com toggle "Modo":
   - "Gerar textos" (preenche website_settings como hoje)
   - "Gerar site completo" (gera SiteLayoutV2 e salva como draft_v2)
2. Após geração completa, redirecionar para o editor avançado com o draft carregado
3. Loading state com progresso

### Fluxo de dados
```
AIContentDialog → Edge Function → Lovable AI (tool calling)
                                → Busca brand_settings, properties, org
                                → Monta SiteLayoutV2
                                → Salva em site_documents.draft_v2
                                → Retorna sucesso
                                → Frontend abre editor com draft
```

## Tarefas

1. **Criar edge function `generate-site-v2`**
   - Buscar dados da org (brand, properties, settings)
   - Montar prompt com contexto real
   - Chamar Lovable AI com tool calling para JSON estruturado
   - Validar e montar SiteLayoutV2 a partir da resposta
   - Salvar em site_documents

2. **Atualizar AIContentDialog**
   - Adicionar seletor de modo (textos vs site completo)
   - Chamar nova edge function no modo "site completo"
   - Manter fluxo atual para modo "textos"

3. **Integrar com editor**
   - Após geração, abrir editor avançado com draft_v2 carregado
   - Ativar modo advanced automaticamente se ainda não estiver

4. **Validar qualidade**
   - Testar com Porto Caiçara (dados ricos)
   - Testar com org sem dados (edge case)

## Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/functions/generate-site-v2/index.ts` | Criar |
| `src/components/settings/AIContentDialog.tsx` | Atualizar |
| `src/hooks/useSiteAIGeneration.ts` | Criar (hook para chamar a edge function) |

## Riscos
- Qualidade do layout gerado pela IA — mitigado com templates pré-definidos como "cardápio"
- Token limits — mitigado com prompt conciso e tool calling
- Dados vazios — fallback para presets padrão
