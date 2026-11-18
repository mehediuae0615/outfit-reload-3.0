-- OUTFIT RELOAD 3.0 — Customer Order Tracking
-- Run in Supabase SQL Editor. Public lookup reveals order details only
-- when BOTH order number and checkout phone number match.

create or replace function public.track_customer_order(
  p_order_number text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_phone text;
  v_items jsonb;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if length(v_phone) < 10 or length(v_phone) > 15
     or length(trim(coalesce(p_order_number, ''))) < 5 then
    return jsonb_build_object('found', false);
  end if;

  select o.* into v_order
  from public.orders o
  where upper(o.order_number) = upper(trim(p_order_number))
    and regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g') = v_phone
  limit 1;

  if not found then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_name', oi.product_name,
    'size', oi.size,
    'color', oi.color,
    'quantity', oi.quantity,
    'line_total', oi.line_total
  ) order by oi.id), '[]'::jsonb)
  into v_items
  from public.order_items oi
  where oi.order_id = v_order.id;

  return jsonb_build_object(
    'found', true,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'delivery_area', v_order.delivery_area,
    'subtotal', v_order.subtotal,
    'delivery_fee', v_order.delivery_fee,
    'total', v_order.total,
    'items', v_items
  );
end;
$$;

revoke all on function public.track_customer_order(text, text) from public;
grant execute on function public.track_customer_order(text, text) to anon, authenticated;
