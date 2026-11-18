-- OUTFIT RELOAD 3.0 — Admin Order Management
-- Run this once in Supabase SQL Editor after the Checkout Database Setup.

create or replace function public.admin_update_order_status(
  p_order_id uuid,
  p_new_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1 from public.admin_users a where a.user_id = auth.uid()
  ) then
    raise exception 'You are not authorized to update orders.';
  end if;

  if p_new_status not in ('pending','confirmed','processing','shipped','delivered','cancelled') then
    raise exception 'Invalid order status.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found.';
  end if;

  if v_order.status = 'cancelled' and p_new_status <> 'cancelled' then
    raise exception 'A cancelled order cannot be reopened. Create a new order instead.';
  end if;

  -- Return reserved stock exactly once when an order is cancelled.
  if v_order.status <> 'cancelled' and p_new_status = 'cancelled' then
    for v_item in
      select * from public.order_items where order_id = p_order_id
    loop
      if v_item.product_id is not null then
        if exists (
          select 1 from public.product_variants pv
          where pv.product_id = v_item.product_id
            and pv.size = coalesce(v_item.size, 'One Size')
            and pv.color = coalesce(v_item.color, 'Default')
        ) then
          update public.product_variants
          set stock = stock + v_item.quantity
          where product_id = v_item.product_id
            and size = coalesce(v_item.size, 'One Size')
            and color = coalesce(v_item.color, 'Default');

          update public.products p
          set stock = coalesce((
            select sum(pv.stock) from public.product_variants pv
            where pv.product_id = p.id
          ), p.stock)
          where p.id = v_item.product_id;
        else
          update public.products
          set stock = stock + v_item.quantity
          where id = v_item.product_id;
        end if;
      end if;
    end loop;
  end if;

  update public.orders
  set status = p_new_status,
      updated_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.admin_update_order_status(uuid,text) from public;
grant execute on function public.admin_update_order_status(uuid,text) to authenticated;
