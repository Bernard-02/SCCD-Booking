-- SCCD Booking — 送單 RPC
-- 一次 checkout 可能含多個時段（多張訂單），全部包在同一個 transaction：
-- 要嘛全部成立（訂單＋品項＋通知），要嘛全部不算，不會有半張訂單。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。

create or replace function public.submit_orders(p_orders jsonb)
returns text[]
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_year int := extract(year from now())::int;
  v_seq int;
  v_order jsonb;
  v_order_id bigint;
  v_rental text;
  v_numbers text[] := '{}';
  v_equip_dep int;
  v_space_dep int;
begin
  if v_uid is null then
    raise exception '未登入';
  end if;
  if p_orders is null or jsonb_array_length(p_orders) = 0 then
    raise exception '沒有可送出的訂單';
  end if;

  for v_order in select * from jsonb_array_elements(p_orders) loop
    -- 押金於伺服器端計算：設備／空間各 cap 5,000（不信任前端傳值）
    select coalesce(sum((i ->> 'deposit')::int * (i ->> 'quantity')::int), 0)
      into v_equip_dep
      from jsonb_array_elements(v_order -> 'items') i
      where i ->> 'item_type' = 'equipment';
    select coalesce(sum((i ->> 'deposit')::int * (i ->> 'quantity')::int), 0)
      into v_space_dep
      from jsonb_array_elements(v_order -> 'items') i
      where i ->> 'item_type' in ('space-block', 'classroom');
    v_equip_dep := least(v_equip_dep, 5000);
    v_space_dep := least(v_space_dep, 5000);

    -- 流水號：當年度訂單數 + 1（每年重置）。同秒併發撞號時
    -- rental_number 的 unique constraint 會讓整筆交易失敗，前端重送即可（系上規模足夠）
    select count(*) + 1 into v_seq
      from public.orders
      where rental_number like '#' || v_year || '%';
    v_rental := '#' || v_year || lpad(v_seq::text, 3, '0');

    insert into public.orders
      (rental_number, student_id, start_date, end_date, booking_type, status,
       deposit_total, reason, class_name, teacher)
    values
      (v_rental, v_uid,
       (v_order ->> 'start_date')::date, (v_order ->> 'end_date')::date,
       v_order ->> 'booking_type', 'pending',
       v_equip_dep + v_space_dep,
       v_order ->> 'reason', v_order ->> 'class_name', v_order ->> 'teacher')
    returning id into v_order_id;

    insert into public.order_items (order_id, item_type, item_id, name, quantity, deposit)
    select v_order_id,
           i ->> 'item_type',
           i ->> 'item_id',
           i ->> 'name',
           (i ->> 'quantity')::int,
           (i ->> 'deposit')::int
    from jsonb_array_elements(v_order -> 'items') i;

    insert into public.notifications (student_id, type, title, message, link)
    values (v_uid, 'success', '預約成功',
            '訂單 ' || v_rental || ' 已送出，請於 24 小時內繳交押金。', '/profile');

    v_numbers := v_numbers || v_rental;
  end loop;

  return v_numbers;
end;
$$;
