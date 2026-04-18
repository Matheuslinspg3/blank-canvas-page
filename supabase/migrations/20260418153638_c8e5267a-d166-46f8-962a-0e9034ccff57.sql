-- Credenciais de passkey registradas
create table public.user_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_id text unique not null,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  device_name text,
  aaguid uuid,
  backed_up boolean not null default false,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index idx_user_passkeys_user_id on public.user_passkeys(user_id);
create index idx_user_passkeys_credential_id on public.user_passkeys(credential_id);

alter table public.user_passkeys enable row level security;

create policy "users read own passkeys"
  on public.user_passkeys
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "users delete own passkeys"
  on public.user_passkeys
  for delete
  to authenticated
  using (user_id = auth.uid());

-- INSERT/UPDATE somente via service role (edge functions) — nenhuma policy criada para esses comandos

-- Challenges efêmeros do WebAuthn (TTL 5 min)
create table public.webauthn_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge text not null,
  user_id uuid references auth.users(id) on delete cascade,
  email text,
  type text not null check (type in ('registration','authentication')),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_webauthn_challenges_expires on public.webauthn_challenges(expires_at);
create index idx_webauthn_challenges_user on public.webauthn_challenges(user_id);
create index idx_webauthn_challenges_email on public.webauthn_challenges(email);

alter table public.webauthn_challenges enable row level security;
-- Sem policies: acesso somente via service role

-- Função utilitária para limpar challenges expirados (será chamada pelas edge functions)
create or replace function public.cleanup_expired_webauthn_challenges()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.webauthn_challenges
  where expires_at < now() - interval '1 hour';
end;
$$;