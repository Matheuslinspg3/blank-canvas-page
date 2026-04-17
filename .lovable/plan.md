

## Plano — Gestão completa de Comodidades por corretor

### Estado atual
- Tabela `property_amenities` (org-level) já existe com seed de defaults (Piscina, Academia, etc).
- `AmenitiesPickerDialog` permite **criar** novas, mas **não editar nem excluir**.
- Filtro de imóveis (`PropertyFilters` → `useAdvancedPropertySearch`) já consome `availableAmenities` via `usePropertyFilters` — então **comodidades novas já aparecem no filtro automaticamente**. Ponto OK.
- RLS atual: `Members can view`, `Managers can manage` (qualquer membro da org pode insert/update/delete via FOR ALL — política está frouxa).

### O que falta
1. **UI de edição e exclusão** dentro do `AmenitiesPickerDialog`.
2. **Regra de quem pode mexer**: corretor edita/apaga **só o que ele criou**; admin/sub_admin pode tudo. Defaults (`is_default = true`) ninguém apaga (mas admin pode renomear).
3. Hook `usePropertyAmenities` ganha `updateAmenity` e `deleteAmenity`.
4. Avisar antes de excluir uma comodidade que está em uso por imóveis (mostrar contagem).

### Mudanças

**1. Migration — RLS granular + helper de uso**
```sql
-- Substituir política única "Managers can manage" por políticas por ação
DROP POLICY "Managers can manage amenities" ON property_amenities;

-- INSERT: qualquer membro da org
CREATE POLICY "Members can create amenities" ON property_amenities
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id() AND created_by = auth.uid());

-- UPDATE: dono OU admin/sub_admin; nunca permite trocar org
CREATE POLICY "Owner or admin can update amenities" ON property_amenities
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND (created_by = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'sub_admin'))
  );

-- DELETE: dono OU admin/sub_admin; nunca apaga is_default
CREATE POLICY "Owner or admin can delete amenities" ON property_amenities
  FOR DELETE TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND is_default = false
    AND (created_by = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'sub_admin'))
  );

-- Função: contar quantos imóveis usam uma comodidade
CREATE FUNCTION count_amenity_usage(p_name text) RETURNS int ...
  SELECT count(*) FROM properties
  WHERE organization_id = get_user_organization_id() AND p_name = ANY(amenities);
```
- Trigger leve: `BEFORE UPDATE` bloqueia mudança de `organization_id` e `created_by`.
- Sanitização: trim no `name`; conflito (UNIQUE org+name) já existe.

**2. Hook `usePropertyAmenities.ts`**
- Add `useUpdateAmenity({ id, name, category })`.
- Add `useDeleteAmenity(id)` — chama `count_amenity_usage` antes; se >0, retorna info pra UI exibir confirm.
- Invalidate `["property-amenities"]` e `["property-amenities-filter"]` em ambos.

**3. UI `AmenitiesPickerDialog.tsx`**
- Cada item da lista ganha menu de 3 pontinhos (visível apenas se o usuário pode editar/apagar):
  - **Editar**: abre inline edit (input + select de categoria) → salva via update.
  - **Excluir**: confirm dialog. Se `usage > 0`, mostra "X imóveis usam esta característica. Excluir vai removê-la deles. Continuar?" e dispara também `UPDATE properties SET amenities = array_remove(amenities, 'X')` via RPC.
  - Defaults (`is_default = true`) escondem o botão excluir; só admin vê editar.
- Badge "Padrão" sutil em itens default.
- Badge "Minha" em itens criados pelo usuário atual.

**4. RPC `remove_amenity_from_properties(p_name text)`**
- SECURITY DEFINER, restrito a org do caller, faz `array_remove` em todos os `properties.amenities` da org. Chamada após delete confirmado com uso.

**5. Filtro — sem mudança necessária**
- `usePropertyFilters.availableAmenities` já agrega `property_amenities` + `properties.amenities`. Ao criar/editar/apagar, o `invalidateQueries(['property-amenities-filter'])` mantém filtro sincronizado.

### Arquivos
- `supabase/migrations/<novo>.sql` — RLS por ação, trigger guard, `count_amenity_usage`, `remove_amenity_from_properties`.
- `src/hooks/usePropertyAmenities.ts` — `useUpdateAmenity`, `useDeleteAmenity`, expor `created_by` no select.
- `src/components/properties/form/AmenitiesPickerDialog.tsx` — menu por item, edit inline, delete com confirm + cleanup, badges.

### Resultado
- Corretor cria → vira "dono" → pode editar/apagar **só as próprias**.
- Admin/sub_admin pode editar qualquer uma; defaults ficam protegidos contra delete.
- Excluir uma comodidade em uso pede confirmação e limpa de todos os imóveis.
- Filtro atualiza automaticamente após qualquer mudança.

