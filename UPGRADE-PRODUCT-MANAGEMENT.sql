-- Outfit Reload 3.0 | Product Management Upgrade
-- Run once in Supabase SQL Editor. Safe to re-run.

alter table public.products
  add column if not exists material text,
  add column if not exists size_guide text,
  add column if not exists new_arrival boolean not null default false,
  add column if not exists best_seller boolean not null default false,
  add column if not exists trending boolean not null default false;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null default 'One Size',
  color text not null default 'Default',
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);

alter table public.product_variants enable row level security;
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

 drop policy if exists "Public can view variants of active products" on public.product_variants;
create policy "Public can view variants of active products"
on public.product_variants for select to anon, authenticated
using (exists (
  select 1 from public.products p
  where p.id = product_variants.product_id and p.is_active = true
));

drop policy if exists "Admins can manage product variants" on public.product_variants;
create policy "Admins can manage product variants"
on public.product_variants for all to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Ensure authenticated admin CRUD grants are present.
grant select, insert, update, delete on public.products, public.categories to authenticated;
grant select on public.products, public.categories to anon;
