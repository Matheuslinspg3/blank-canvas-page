

# Plan: Seção customizada, estilos no botão, link picker e posicionamento livre

## Problemas identificados

1. **Sem seção "em branco"**: Todas as seções no catálogo vem com conteúdo predefinido. Falta uma seção vazia/customizada onde o usuario coloca o que quiser.

2. **Borda aplica no container, não no botão**: O `ButtonElement` renderiza dentro de `ElementWrapper`, que aplica todos os estilos (borda, sombra, raio) no `<div>` wrapper externo. O botão em si fica sem estilo visual direto.

3. **Link do botão é texto livre sem sugestões**: O campo de link aceita qualquer texto (ex: "google") sem validar ou sugerir links internos (paginas, ancoras). O usuario pode digitar algo que nao funciona.

4. **Botão fixo em 3 posições (sm/md/lg)**: Não ha opção de posicionamento absoluto livre para o botão -- ele so funciona em modo stack dentro da coluna.

---

## Alteracoes

### 1. Seção customizada em branco
**Arquivo**: `src/components/siteBuilder/v2/sectionTemplates/templates/customBlank.ts` (novo)

- Registrar template `custom-blank` com category `custom`
- Gera uma seção vazia com 1 row, 1 coluna (12/12), sem elementos
- Coluna em modo `stack` por padrão, com minHeight de 200px
- Label: "Seção em branco"

**Arquivo**: `src/components/siteBuilder/v2/sectionTemplates/index.ts`
- Importar o novo template

### 2. Estilos aplicados diretamente no botão
**Arquivo**: `src/components/siteBuilder/v2/elements/basic/Button/ButtonElement.tsx`

- Mover os estilos visuais (borderRadius, borderWidth, borderColor, borderStyle, boxShadow) do `ElementWrapper` para o proprio `<button>/<a>`, aplicando inline
- Manter o `ElementWrapper` apenas para padding/margin/background do container
- Separar: container cuida de espacamento, botão cuida de aparencia visual

### 3. Link picker com sugestões internas
**Arquivo**: `src/components/siteBuilder/v2/elements/basic/Button/ButtonInspector.tsx`

- Substituir o campo de texto livre por um componente com sugestões
- Listar automaticamente: paginas do site (`/`, `/imoveis`, `/sobre`, `/contato`), ancoras das seções (`#imoveis`, `#sobre`, `#contato`), e opção de URL externa
- Validar URLs externas: se nao comecar com `http://`, `https://`, `#` ou `/`, prefixar automaticamente com `https://`
- Mostrar as opções como lista clicavel acima do input

### 4. Botão com suporte a posicionamento absoluto
**Arquivo**: `src/components/siteBuilder/v2/elements/basic/Button/ButtonInspector.tsx`

- Adicionar secao "Posicionamento" no inspector quando a coluna pai esta em modo `absolute`
- Campos: X, Y, Largura, Altura (ja suportados pelo sistema de layout existente via `UPDATE_ELEMENT_LAYOUT`)

**Nota**: O sistema de drag absoluto ja existe no Canvas -- quando a coluna esta em modo `absolute`, elementos podem ser arrastados livremente. O que falta e tornar isso mais acessivel:
- No inspector do botão, mostrar campos numéricos de posição
- No `CommonStylesEditor` ou no inspector, indicar que o modo absoluto esta ativo

---

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/components/siteBuilder/v2/sectionTemplates/templates/customBlank.ts` | Novo template em branco |
| `src/components/siteBuilder/v2/sectionTemplates/index.ts` | Import do novo template |
| `src/components/siteBuilder/v2/elements/basic/Button/ButtonElement.tsx` | Estilos visuais no botão |
| `src/components/siteBuilder/v2/elements/basic/Button/ButtonInspector.tsx` | Link picker com sugestões + campos de posição |

