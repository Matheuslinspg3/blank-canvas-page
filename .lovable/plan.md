## Diagnóstico

Investiguei o banco de dados e o código do formulário de imóveis. **Os dados ESTÃO sendo gravados corretamente** no Supabase:

- Coluna `properties.property_type_id` (uuid) ✅ existe e tem valores nos registros recentes.
- Coluna `properties.captador_id` (uuid) ✅ existe e tem valores nos registros recentes (ex.: `b93b4b0e-...`).
- O insert em `usePropertyCRUD.ts` faz `...propertyData` (spread), então qualquer campo do form vai pro DB.

O problema percebido pelo usuário (no print "Editar Imóvel" os campos aparecem como "Selecione o tipo" e "Selecione o captador" mesmo o imóvel já tendo esses dados) é uma **falha de re-hidratação do `<Select>` no modo edição**, não de gravação.

### Causas técnicas

1. **Race condition entre `form.reset(...)` e o carregamento das listas (`usePropertyTypes` / `useBrokers`).**
   - Quando o dialog abre, `form.reset({ property_type_id, captador_id, ... })` é chamado imediatamente.
   - Os `<SelectItem>` dependem de `propertyTypes` e `brokers`, que são `useQuery` assíncronos.
   - Se a lista vier vazia/loading no momento em que o `<Select value={field.value}>` monta, o Radix Select renderiza o placeholder. Em alguns navegadores (especialmente Chrome Mobile WebView Android, conforme stack do Sentry) o `<SelectValue>` não atualiza o label visível depois que a lista chega — embora o `value` interno esteja correto. Isso faz o usuário pensar que perdeu o dado.

2. **Risco real de regressão em "Salvar" sem reabrir os selects.**
   - Se o usuário, vendo o campo "vazio", abre o select e escolhe outro item, OK.
   - Mas se ele apenas edita outro campo (ex.: preço) e salva, o `field.value` interno foi preservado pelo `reset`, então grava certo. Confirmamos isso pelos registros recentes onde os valores se mantêm.
   - O bug é portanto **visual/UX**, mas crítico porque o usuário não confia no sistema.

3. **`captador_id` no select usa `broker.user_id`** como `value` (em vez de `broker.id`). O dado salvo no DB de fato é `user_id` — confirmado no banco. Está consistente, mas vamos garantir.

## Correção proposta

### 1. Garantir que o `form.reset(...)` no modo edição só ocorra DEPOIS que `propertyTypes` e `brokers` estejam carregados (`PropertyForm.tsx`)

- Adicionar dependência de `usePropertyTypes().isLoading` e `useBrokers().isLoading` (ou seu `isFetched`) no `useEffect` que chama `form.reset` em modo edição.
- Enquanto as listas não chegarem, mostrar um estado de loading no corpo do dialog (skeleton ou spinner) para evitar render do form com Selects vazios.

### 2. Tornar o `<Select>` resiliente quando o valor existe mas o item ainda não está na lista (`BasicTab.tsx`)

- No `<Select>` de "Tipo de Imóvel": se `field.value` existir mas não houver match em `propertyTypes`, renderizar um `<SelectItem value={field.value}>` "fantasma" com label "(carregando…)" para que o Radix consiga exibir um label e não caia no placeholder.
- Mesma coisa para o `<Select>` de "Corretor Captador": se `field.value` existir e não houver match em `brokers`, renderizar um item placeholder com o id, evitando o "Selecione o captador" enganoso.
- Esse padrão é defensivo: cobre lista atrasada, broker removido, ou tipo deletado.

### 3. Logging/telemetria leve para confirmar em produção

- Em `useEffect` de reset, logar (apenas em dev/preview, gated por `isProductionBuild === false`) quando `property.property_type_id` ou `property.captador_id` chegar mas a lista correspondente estiver vazia. Não enviar pro Sentry — só `console.debug`.

### 4. (Opcional, defensivo) Garantir que o submit nunca grave `null` se o usuário não tocou no campo

- No `handleSubmit` em `PropertyForm.tsx`, se `restData.property_type_id` vier `null` mas `property?.property_type_id` (no modo edição) tinha valor, **manter** o valor antigo. Mesmo padrão para `captador_id`.
- Isso é cinto-e-suspensório: protege contra qualquer cenário em que o `form.reset` não tenha aplicado o valor antes do submit.

## Escopo de arquivos

- `src/components/properties/PropertyForm.tsx`
  - Aguardar `propertyTypes` + `brokers` carregarem antes de `form.reset` no modo edição.
  - Estado de loading no dialog enquanto isso.
  - Guard no `handleSubmit` (ponto 4).
- `src/components/properties/form/BasicTab.tsx`
  - Renderizar `<SelectItem>` "fantasma" quando `field.value` não tem match na lista.

## O que NÃO vai mudar

- Schema do banco — colunas estão corretas.
- Lógica de insert/update no `usePropertyCRUD.ts` — está correta.
- `useBrokers` / `usePropertyTypes` — estão corretos.

## Validação

- Build + typecheck.
- Teste manual no preview: abrir um imóvel existente para editar → ambos os campos devem aparecer já preenchidos imediatamente, mesmo em conexão lenta.
- Verificação no banco: criar novo imóvel pelo form → confirmar `property_type_id` e `captador_id` populados (já estavam funcionando, mas re-validar).
