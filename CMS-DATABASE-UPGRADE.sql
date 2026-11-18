-- Outfit Reload 3.0 Website Content Manager migration
-- Run this in Supabase SQL Editor after uploading the ZIP.
-- Preserves existing store_settings policies and the original COD function logic.

create table if not exists public.store_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Keep the existing announcement value unchanged.
insert into public.store_settings(key,value) values
 ('delivery_inside','80'),('delivery_outside','130'),('cms_global','{}')
on conflict (key) do nothing;

CREATE OR REPLACE FUNCTION public.place_cod_order(p_customer_name text, p_customer_phone text, p_customer_email text, p_delivery_area text, p_delivery_address text, p_customer_note text, p_items jsonb)
 RETURNS TABLE(order_id uuid, order_number text, order_total numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_delivery_fee numeric(12,2);
  v_total numeric(12,2);
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_qty integer;
  v_size text;
  v_color text;
  v_line numeric(12,2);
  v_has_variants boolean;
begin
  if length(trim(coalesce(p_customer_name,''))) < 2 then
    raise exception 'Please enter your full name.';
  end if;

  if length(regexp_replace(coalesce(p_customer_phone,''), '[^0-9]', '', 'g')) < 10 then
    raise exception 'Please enter a valid phone number.';
  end if;

  if p_delivery_area not in ('inside_dhaka','outside_dhaka') then
    raise exception 'Please choose a delivery area.';
  end if;

  if length(trim(coalesce(p_delivery_address,''))) < 8 then
    raise exception 'Please enter your complete delivery address.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your shopping bag is empty.';
  end if;

  if jsonb_array_length(p_items) > 30 then
    raise exception 'Too many different products in one order.';
  end if;

  select coalesce((select value::numeric from public.store_settings where key = case when p_delivery_area = 'inside_dhaka' then 'delivery_inside' else 'delivery_outside' end), case when p_delivery_area = 'inside_dhaka' then 80 else 130 end) into v_delivery_fee;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;

    if v_qty < 1 or v_qty > 20 then
      raise exception 'Quantity must be between 1 and 20.';
    end if;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid and is_active = true
    for update;

    if not found then
      raise exception 'A product in your bag is no longer available. Please refresh your bag.';
    end if;

    v_size := coalesce(nullif(trim(v_item->>'size'),''),'One Size');
    v_color := coalesce(nullif(trim(v_item->>'color'),''),'Default');

    select exists(
      select 1 from public.product_variants pv
      where pv.product_id = v_product.id
    ) into v_has_variants;

    if v_has_variants then
      select * into v_variant
      from public.product_variants pv
      where pv.product_id = v_product.id
        and pv.size = v_size
        and pv.color = v_color
      for update;

      if not found then
        raise exception 'The selected size or colour is unavailable for %.', v_product.name;
      end if;

      if v_variant.stock < v_qty then
        raise exception 'Not enough stock for %. Available: %.', v_product.name, v_variant.stock;
      end if;

      update public.product_variants
      set stock = stock - v_qty
      where id = v_variant.id;
    else
      if v_product.stock < v_qty then
        raise exception 'Not enough stock for %. Available: %.', v_product.name, v_product.stock;
      end if;

      update public.products
      set stock = stock - v_qty
      where id = v_product.id;
    end if;

    v_line := v_product.price * v_qty;
    v_subtotal := v_subtotal + v_line;
  end loop;

  v_total := v_subtotal + v_delivery_fee;
  v_order_number := 'OR-' || upper(substr(md5(random()::text || clock_timestamp()::text),1,8));

  insert into public.orders(
    order_number, customer_name, customer_phone, customer_email,
    delivery_area, delivery_address, customer_note, payment_method,
    subtotal, delivery_fee, total
  ) values (
    v_order_number,
    trim(p_customer_name),
    trim(p_customer_phone),
    nullif(trim(coalesce(p_customer_email,'')),''),
    p_delivery_area,
    trim(p_delivery_address),
    nullif(trim(coalesce(p_customer_note,'')),''),
    'cod',
    v_subtotal, v_delivery_fee, v_total
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::integer;
    v_size := coalesce(nullif(trim(v_item->>'size'),''),'One Size');
    v_color := coalesce(nullif(trim(v_item->>'color'),''),'Default');

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid;

    insert into public.order_items(
      order_id, product_id, product_name, unit_price, size, color, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_product.name, v_product.price, v_size, v_color,
      v_qty, v_product.price * v_qty
    );
  end loop;

  return query select v_order_id, v_order_number, v_total;
end;
$function$


-- No RLS policies are dropped or weakened by this migration.
