
drop policy if exists "Admins can update RD Station settings" on public.rd_station_settings;
drop policy if exists "Admins can view RD Station settings" on public.rd_station_settings;
drop policy if exists "Managers can insert rd_station_settings" on public.rd_station_settings;
drop policy if exists "Managers can update rd_station_settings" on public.rd_station_settings;
drop policy if exists "Managers can view own org rd_station_settings" on public.rd_station_settings;

create policy "Org managers can view rd_station_settings"
on public.rd_station_settings for select to authenticated
using (
  organization_id = public.get_user_organization_id()
  and public.is_org_manager_or_above(auth.uid())
);

create policy "Org managers can insert rd_station_settings"
on public.rd_station_settings for insert to authenticated
with check (
  organization_id = public.get_user_organization_id()
  and public.is_org_manager_or_above(auth.uid())
);

create policy "Org managers can update rd_station_settings"
on public.rd_station_settings for update to authenticated
using (
  organization_id = public.get_user_organization_id()
  and public.is_org_manager_or_above(auth.uid())
)
with check (
  organization_id = public.get_user_organization_id()
  and public.is_org_manager_or_above(auth.uid())
);
