-- Track server-side processing validations with short-lived tokens
create table if not exists public.processing_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists processing_tokens_user_id_idx
  on public.processing_tokens (user_id);

create index if not exists processing_tokens_expires_at_idx
  on public.processing_tokens (expires_at);

alter table public.processing_tokens enable row level security;
