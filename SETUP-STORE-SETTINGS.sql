-- Run this once in Supabase SQL Editor to enable announcement editing.
create table if not exists public.store_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.store_settings enable row level security;
drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings" on public.store_settings
for select to anon, authenticated using (true);
drop policy if exists "Admins can manage store settings" on public.store_settings;
create policy "Admins can manage store settings" on public.store_settings
for all to authenticated
using (exists (select 1 from public.admin_users where user_id=auth.uid()))
with check (exists (select 1 from public.admin_users where user_id=auth.uid()));
insert into public.store_settings(key,value) values ('announcement','WE FOCUS QUALITY, NOT QUANTITY.')
on conflict (key) do nothing;
