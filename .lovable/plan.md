

# Duplicar com Variações — Plano de Implementação (MVP)

## Resumo

Adicionar ao detalhe do imóvel uma ação "Duplicar com variações" que abre uma interface tipo planilha onde o usuário preenche apenas os campos que variam entre unidades. Todos os dados compartilhados são herdados do imóvel-base. Ao confirmar, o sistema cria os imóveis em lote como rascunho, vinculados por um `property_group_id`.

---

## 1. Modelagem de Banco

### Nova tabela: `property_groups`

```sql
CREATE TABLE public.property_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.property_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON public.property_groups
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());
```

### Nova coluna em `properties`

```sql
ALTER TABLE public.properties
  ADD COLUMN property_group_id uuid REFERENCES property_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_properties_group ON properties(property_group_id) WHERE property_group_id IS NOT NULL;
```

**Decisao**: `property_group_id` na tabela `properties` (em vez de `parent_property_id`) porque:
- Permite agrupar N imóveis sem hierarquia pai/filho
- Imóveis ficam independentes para edição
- Futuramente permite criar grupo sem imóvel-base
- A tabela `property_groups` guarda o `source_property_id` para rastreabilidade de origem

---

## 2. Novos Arquivos

### `src/components/properties/BatchVariationsDialog.tsx`
Dialog principal (fullscreen ou max-w-5xl). Contém:
- **Header**: nome do imóvel-base, resumo dos dados herdados (endereço, tipo, condomínio)
- **Grade editável**: tabela com colunas variáveis
- **Footer**: ações (adicionar linha, revisar, cancelar)

### `src/components/properties/VariationsGrid.tsx`
Componente da grade tipo planilha com:
- Colunas: Código/Ref, Unidade/Lote, Quartos, Suítes, Banheiros, Vagas, Área Útil, Área Total, Valor (venda), Status, Observação
- Inputs inline editáveis (numéricos e texto)
- Botões por linha: duplicar linha, excluir linha
- Botão "Adicionar linha" no rodapé
- Suporte a colar do Excel (evento `onPaste` no container, parse tab-separated values)
- Navegação por Tab entre células

### `src/components/properties/VariationsReviewDialog.tsx`
Dialog de revisão final mostrando:
- Quantidade de imóveis a criar
- Lista resumida com erros por linha (código duplicado, campos inválidos, linhas vazias)
- Botão "Confirmar e criar" / "Voltar para editar"

### `src/hooks/usePropertyBatchCreate.ts`
Hook que:
- Recebe dados base + array de variações
- Cria o `property_group` primeiro
- Itera sobre variações, merge com dados base, insere cada imóvel com `property_group_id` e `status: 'disponivel'` (rascunho = inativo ou status configurável)
- Copia imagens do imóvel-base para cada novo imóvel (referência por URL, sem re-upload)
- Valida códigos duplicados contra DB antes de inserir
- Retorna resultado por linha (sucesso/erro)
- Invalida cache `properties-list`

---

## 3. Alterações em Arquivos Existentes

### `src/pages/PropertyDetails.tsx`
- Adicionar botão "Duplicar com variações" logo abaixo do botão "Duplicar Imóvel" existente (icone `Layers` ou `Grid3X3`)
- State para controlar abertura do `BatchVariationsDialog`
- Passar `property` como prop para o dialog

### `src/integrations/supabase/types.ts`
- Atualizado automaticamente pela migration (novas colunas/tabelas)

---

## 4. Fluxo UX Detalhado

1. Usuário abre detalhe do imóvel, clica **"Duplicar com variações"**
2. Abre `BatchVariationsDialog` mostrando:
   - Card compacto com dados herdados (endereço, tipo, condomínio, amenidades - somente leitura)
   - Grade vazia com 3 linhas pré-preenchidas (valores do imóvel-base)
3. Usuário edita os campos variáveis em cada linha
4. Pode adicionar linhas (+), duplicar linha existente, excluir linha
5. Pode colar dados do Excel (tab-separated) numa célula - o sistema distribui os valores
6. Clica **"Revisar"**
7. `VariationsReviewDialog` mostra:
   - "Serão criados X imóveis"
   - Erros detectados (código duplicado, linha vazia, valor inválido) com destaque vermelho
   - Se houver erros, botão "Voltar para corrigir"
   - Se tudo OK, botão "Criar X imóveis"
8. Ao confirmar, cria em lote. Toast de sucesso com contagem. Redireciona para lista com filtro do grupo.

---

## 5. Validações

- **Código/referência**: verificar unicidade contra banco antes de criar (batch query)
- **Linhas vazias**: ignorar linhas onde todos os campos variáveis estão vazios
- **Limites de plano**: verificar `max_own_properties` contra total atual + quantidade de linhas
- **Unidade duplicada**: alertar se duas linhas tiverem mesma unidade/lote dentro do batch

---

## 6. Detalhes Técnicos

- Imóveis criados com `status: 'disponivel'` (padrão) - o campo status na grade permite mudar para 'inativo' (rascunho)
- Imagens: copiar referências (URLs) do imóvel-base para todos os novos - sem re-upload físico
- Owner data: copiar do imóvel-base se existir
- `property_code`: se não preenchido na linha, gerar automaticamente (trigger existente no DB)
- Inserção sequencial (não paralela) para respeitar rate limits e feature gates
- Em caso de erro parcial: imóveis já criados permanecem, toast informa quantos foram criados e qual falhou

---

## 7. Fora do MVP (preparado na modelagem)

- `property_groups.name` permite nomear o grupo (ex: "Condomínio Vila Nova")
- `source_property_id` permite rastrear origem mesmo se o imóvel-base for deletado (SET NULL)
- A grade pode ser expandida futuramente para edição em massa de grupos existentes
- Importação CSV pode popular a grade diretamente

---

## Ordem de Implementação

1. Migration SQL (tabela `property_groups` + coluna `property_group_id`)
2. Hook `usePropertyBatchCreate`
3. Componente `VariationsGrid` (grade editável)
4. Componente `VariationsReviewDialog` (revisão)
5. Componente `BatchVariationsDialog` (orquestra tudo)
6. Integração no `PropertyDetails.tsx` (botão + state)

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| Limite de plano excedido durante batch | Verificar antes de iniciar, considerando total de linhas |
| Código duplicado entre linhas | Validação local + query batch no DB |
| Muitas imagens por imóvel × muitas linhas | Copiar apenas referências URL, não re-upload |
| Fluxo de duplicação simples quebrar | Zero alteração no `handleDuplicate` existente |

