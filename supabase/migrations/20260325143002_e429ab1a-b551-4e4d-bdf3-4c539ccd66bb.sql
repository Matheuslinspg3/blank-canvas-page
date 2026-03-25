drop policy if exists "Admins can insert ad_settings" on public.ad_settings;
drop policy if exists "Admins can update ad_settings" on public.ad_settings;

create policy "Managers can insert ad_settings"
on public.ad_settings
for insert
to authenticated
with check (
  organization_id = public.get_user_organization_id()
  and public.get_user_organization_id() is not null
  and public.is_org_manager_or_above(auth.uid())
);

create policy "Managers can update ad_settings"
on public.ad_settings
for update
to authenticated
using (
  organization_id = public.get_user_organization_id()
  and public.get_user_organization_id() is not null
  and public.is_org_manager_or_above(auth.uid())
)
with check (
  organization_id = public.get_user_organization_id()
  and public.get_user_organization_id() is not null
  and public.is_org_manager_or_above(auth.uid())
);