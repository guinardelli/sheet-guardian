-- Track watermark identifiers embedded in processed files
create table if not exists public.watermark_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  watermark_id uuid not null unique,
  original_file_name text not null,
  new_file_name text not null,
  created_at timestamptz not null default now()
);

create index if not exists watermark_deliveries_user_id_idx
  on public.watermark_deliveries (user_id);

create index if not exists watermark_deliveries_created_at_idx
  on public.watermark_deliveries (created_at);

alter table public.watermark_deliveries enable row level security;

create policy "Users can view their own watermark deliveries"
on public.watermark_deliveries
for select
using (auth.uid() = user_id);

create policy "Users can create their own watermark deliveries"
on public.watermark_deliveries
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own watermark deliveries"
on public.watermark_deliveries
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own watermark deliveries"
on public.watermark_deliveries
for delete
using (auth.uid() = user_id);
