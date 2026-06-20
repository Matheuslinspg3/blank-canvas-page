-- Auditoria de contas criadas manualmente por developers via painel.
-- Cada criação administrativa (Opção B: criar conta já com email confirmado)
-- registra quem criou, para quem, quando e por quê. Sem isso, criação
-- administrativa vira ação não-rastreável; com isso, é uma operação legítima.

create table if not exists public.admin_created_accounts (
  id uuid primary key default gen_random_uuid(),
  created_user_id uuid not null,
  created_user_email text not null,
  created_by uuid not null,
  reason text,
  created_at timestamptz not null default now()
);

comment on table public.admin_created_accounts is
  'Trilha de auditoria de contas criadas manualmente por developers no painel (admin-users POST).';

create index if not exists idx_admin_created_accounts_created_by
  on public.admin_created_accounts (created_by);
create index if not exists idx_admin_created_accounts_created_at
  on public.admin_created_accounts (created_at desc);

-- RLS: a tabela só é escrita pela service role (edge function). Leitura
-- restrita a developers; ninguém mais enxerga a trilha.
alter table public.admin_created_accounts enable row level security;

drop policy if exists "developers can read admin_created_accounts" on public.admin_created_accounts;
create policy "developers can read admin_created_accounts"
  on public.admin_created_accounts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_roles ur
      where ur.user_id = auth.uid() and ur.role = 'developer'
    )
  );
