create table if not exists public.attribution_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  organization_id uuid null references public.organizations(id) on delete set null,
  lead_id uuid null references public.leads(id) on delete set null,
  event_name text not null,
  event_id text not null,
  source text null,
  medium text null,
  campaign text null,
  content text null,
  term text null,
  fbclid text null,
  gclid text null,
  fbp text null,
  fbc text null,
  landing_page text null,
  referrer text null,
  current_url text null,
  session_id text null,
  anonymous_id text null,
  consent_state jsonb null,
  event_payload jsonb null,
  created_at timestamptz not null default now()
);
create index if not exists idx_attr_event_id on public.attribution_events(event_id);
create index if not exists idx_attr_user on public.attribution_events(user_id);
create index if not exists idx_attr_org on public.attribution_events(organization_id);
create index if not exists idx_attr_lead on public.attribution_events(lead_id);
create index if not exists idx_attr_event_name on public.attribution_events(event_name);
create index if not exists idx_attr_created on public.attribution_events(created_at desc);
create index if not exists idx_attr_campaign on public.attribution_events(campaign);
alter table public.attribution_events enable row level security;
create policy "attr_events_select_org" on public.attribution_events for select using (
  organization_id in (select organization_id from public.profiles where user_id = auth.uid())
);
create policy "attr_events_insert_service" on public.attribution_events for insert with check (auth.role() = 'service_role');
