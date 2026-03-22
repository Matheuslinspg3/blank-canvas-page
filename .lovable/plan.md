
Objetivo: eliminar o 502 em `generate-property-art` quando o AI Router tenta editar imagem com OpenAI.

1) Diagnóstico confirmado (sem alterar código ainda)
- Erro real já identificado nos logs:
  - `OpenAI image-edit 400: Invalid value ... Value must be 'dall-e-2'`
- Causa: `ai-router` está enviando modelo incompatível para `/v1/images/edits` (hoje tenta `dall-e-3` ou forçou `gpt-image-1`), mas essa conta aceita apenas `dall-e-2` para edit.

2) Correção principal no `supabase/functions/ai-router/index.ts`
- Ajustar a lógica de `callOpenAI` (ramo de image edit) para:
  - resolver modelo efetivo de edição com prioridade segura:
    1. `provider.model_id` se já for compatível,
    2. fallback para `dall-e-2` quando vier `dall-e-3`/`gpt-image-1`.
- Normalizar tamanho quando o modelo efetivo for `dall-e-2`:
  - aceitar apenas tamanhos suportados (mapear story/banner para `1024x1024` no edit para evitar novo 400 por size inválido).
- Manter retorno padronizado (`image_base64`) para não quebrar `generate-property-art`.

3) Hardening para evitar novo loop de falha
- Adicionar retry controlado no `callOpenAI` para erros 400 de `invalid_value`:
  - 1 tentativa extra com `model=dall-e-2` e size normalizado.
- Melhorar logs internos no AI Router:
  - logar `requested_model`, `effective_model`, `requested_size`, `effective_size`.
  - isso acelera diagnóstico futuro sem adivinhação.

4) Ajuste de consistência de configuração (DB)
- Atualizar provider de arte no AI Router para refletir capacidade real:
  - `ai_router_providers` do provider OpenAI de arte com `supports_image_input = true` (coerente com uso de edit).
- Revisar `ai_router_config.generate_art` e cadeia para evitar selecionar provider incompatível em futuras mudanças.
- Observação: não muda fluxo do usuário, só evita regressão de roteamento.

5) Validação pós-implementação (E2E)
- Testar geração real no fluxo `/marketing?section=artes` com 1 imóvel/foto.
- Critérios de aceite:
  - não retornar 502;
  - ao menos `url_feed` gerada;
  - logs do `ai-router` sem `invalid_value` de model.
- Confirmar também `generated_arts` gravando registro e UI exibindo resultado sem tela em branco.

Se aprovado, implemento nessa ordem: (1) patch do `ai-router` → (2) ajuste de config/provider → (3) validação E2E e confirmação nos logs.
  
Se você quiser, no mesmo pacote eu já incluo uma melhoria opcional: fallback visual para story/banner quando o provider só suportar edit quadrado (evita “Não disponível”).
  
Seção técnica (resumo)
- Arquivo principal: `supabase/functions/ai-router/index.ts`
- Ponto exato: função `callOpenAI(...)`, bloco `if (isImageModel && imageBase64)`
- Falha atual observada:
  - `model=dall-e-3` em `/images/edits` (inválido)
  - `model=gpt-image-1` em `/images/edits` (inválido nesta conta)
- Comportamento alvo:
  - edição sempre com modelo aceito pela conta (`dall-e-2`)
  - size edit compatível, sem quebrar retorno para `generate-property-art`
