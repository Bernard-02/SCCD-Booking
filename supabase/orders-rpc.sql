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
  v_item jsonb;
  v_order_id bigint;
  v_rental text;
  v_numbers text[] := '{}';
  v_equip_dep int;
  v_space_dep int;
  v_stock int;
  v_reserved int;
  v_grade text;
  v_sophomore_up boolean; -- 大二以上（含碩士）；grade 未填從嚴視為大一
begin
  if v_uid is null then
    raise exception '未登入';
  end if;
  -- 停權檢查（情境 7）：未完成清潔歸還者不可再使用預約系統（擋送單，不擋登入）
  if (select account_level from public.students where id = v_uid) >= 5 then
    raise exception '帳號已停權（未完成清潔歸還），無法送出預約，請聯絡系學會';
  end if;
  if p_orders is null or jsonb_array_length(p_orders) = 0 then
    raise exception '沒有可送出的訂單';
  end if;

  -- 年級慣例：'2'/'3'/'4' 或含「大二/大三/大四/碩」字樣視為大二以上，其餘（含未填）從嚴視為大一
  select grade into v_grade from public.students where id = v_uid;
  v_sophomore_up := coalesce(v_grade, '') ~ '^[234]$'
                 or coalesce(v_grade, '') ~ '(大二|大三|大四|碩)';

  for v_order in select * from jsonb_array_elements(p_orders) loop
    -- 重複下單檢查（rental-rules §6，原僅前端）：同一時段僅能有一張小量訂單
    if v_order ->> 'booking_type' = 'little' and exists (
      select 1 from public.orders o
      where o.student_id = v_uid
        and o.booking_type = 'little'
        and o.status in ('pending', 'in-progress', 'overdue')
        and o.start_date = (v_order ->> 'start_date')::date
        and o.end_date = (v_order ->> 'end_date')::date
    ) then
      raise exception '該時段已有一張小量訂單（同一時段僅能有一張小量訂單）';
    end if;

    -- 庫存檢查：鎖定設備列（for update），避免兩人同時搶最後一件。
    -- 佔用 = 生效訂單（pending / in-progress / overdue）中與本時段重疊的數量
    for v_item in select * from jsonb_array_elements(v_order -> 'items') loop
      if v_item ->> 'item_type' = 'equipment' then
        select stock_quantity into v_stock
          from public.equipment
          where id = v_item ->> 'item_id'
          for update;
        if not found then
          raise exception '設備不存在：%', v_item ->> 'name';
        end if;

        select coalesce(sum(oi.quantity), 0) into v_reserved
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
          where oi.item_type = 'equipment'
            and oi.item_id = v_item ->> 'item_id'
            and o.status in ('pending', 'in-progress', 'overdue')
            and o.start_date <= (v_order ->> 'end_date')::date
            and o.end_date >= (v_order ->> 'start_date')::date;

        if (v_item ->> 'quantity')::int > v_stock - v_reserved then
          raise exception '「%」該時段庫存不足（剩餘 %）',
            v_item ->> 'name', greatest(v_stock - v_reserved, 0);
        end if;

      elsif v_item ->> 'item_type' in ('space-block', 'classroom') then
        -- A508 限大二以上（rental-rules「年級限制」；前端擋是 UX，這裡是防線）
        if v_item ->> 'item_id' = 'A508' and not v_sophomore_up then
          raise exception 'A508 教室僅限大二以上（含碩士）借用';
        end if;

        -- 空間衝突檢查：鎖定該格（序列化同格併發），時段重疊即擋
        perform 1 from public.space
          where id = v_item ->> 'item_id'
          for update;
        if not found then
          raise exception '空間不存在：%', v_item ->> 'name';
        end if;

        if exists (
          select 1
          from public.order_items oi
          join public.orders o on o.id = oi.order_id
          where oi.item_type in ('space-block', 'classroom')
            and oi.item_id = v_item ->> 'item_id'
            and o.status in ('pending', 'in-progress', 'overdue')
            and o.start_date <= (v_order ->> 'end_date')::date
            and o.end_date >= (v_order ->> 'start_date')::date
        ) then
          raise exception '「%」該時段已被預約', v_item ->> 'name';
        end if;
      end if;
    end loop;

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

-- 查詢設備在指定時段的佔用量（給型錄顯示可借數量；只回傳統計，不含個資）
-- reserved = pending + in-progress + overdue 的重疊訂單數量；on_hold = 其中 pending 的部分
create or replace function public.equipment_reserved(p_start date, p_end date)
returns table(item_id text, reserved bigint, on_hold bigint)
language sql
security definer set search_path = public
stable
as $$
  select oi.item_id,
         sum(oi.quantity)::bigint as reserved,
         coalesce(sum(oi.quantity) filter (where o.status = 'pending'), 0)::bigint as on_hold
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.item_type = 'equipment'
    and o.status in ('pending', 'in-progress', 'overdue')
    and o.start_date <= p_end
    and o.end_date >= p_start
  group by oi.item_id;
$$;

-- 查詢指定時段被佔用的空間（區塊／教室）id（給地圖與教室列表顯示；不含個資）
create or replace function public.space_occupied(p_start date, p_end date)
returns table(item_id text)
language sql
security definer set search_path = public
stable
as $$
  select distinct oi.item_id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.item_type in ('space-block', 'classroom')
    and o.status in ('pending', 'in-progress', 'overdue')
    and o.start_date <= p_end
    and o.end_date >= p_start;
$$;

-- 延期自己的訂單：僅限租借中（in-progress）、未延期過、1-7 天。
-- 撞期檢查（情境 8 定案 2026-07-14）：逐品項檢查延長區間有無被其他訂單佔用，
-- 全部品項都能延才放行，並列出撞期品項；部分延期＝拆子單（階段 2 後台 admin 功能）。
create or replace function public.extend_my_order(p_rental_number text, p_days int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_new_end date;
  v_item record;
  v_stock int;
  v_reserved int;
  v_conflicts text[] := '{}';
begin
  if v_uid is null then
    raise exception '未登入';
  end if;
  if p_days < 1 or p_days > 7 then
    raise exception '延期天數需為 1-7 天';
  end if;

  select * into v_order
    from public.orders
    where rental_number = p_rental_number and student_id = v_uid
    for update;

  if not found then
    raise exception '查無此訂單';
  end if;
  if v_order.status <> 'in-progress' then
    raise exception '僅租借中的訂單可延期';
  end if;
  if v_order.has_extended then
    raise exception '此訂單已延期過（僅可延期乙次）';
  end if;

  -- 延長區間 = [原歸還日+1, 新歸還日]，逐品項檢查與其他生效訂單的衝突
  v_new_end := v_order.end_date + p_days;
  for v_item in
    select item_type, item_id, name, quantity
    from public.order_items where order_id = v_order.id
  loop
    if v_item.item_type = 'equipment' then
      select stock_quantity into v_stock
        from public.equipment where id = v_item.item_id for update;

      select coalesce(sum(oi.quantity), 0) into v_reserved
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where oi.item_type = 'equipment'
          and oi.item_id = v_item.item_id
          and o.id <> v_order.id
          and o.status in ('pending', 'in-progress', 'overdue')
          and o.start_date <= v_new_end
          and o.end_date >= v_order.end_date + 1;

      if v_item.quantity > coalesce(v_stock, 0) - v_reserved then
        v_conflicts := v_conflicts || v_item.name;
      end if;

    else -- space-block / classroom
      if exists (
        select 1
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where oi.item_type in ('space-block', 'classroom')
          and oi.item_id = v_item.item_id
          and o.id <> v_order.id
          and o.status in ('pending', 'in-progress', 'overdue')
          and o.start_date <= v_new_end
          and o.end_date >= v_order.end_date + 1
      ) then
        v_conflicts := v_conflicts || v_item.name;
      end if;
    end if;
  end loop;

  if array_length(v_conflicts, 1) > 0 then
    raise exception '無法延期：「%」於延長期間已被其他訂單預約。如需延期其餘品項，請聯絡系學會協助處理',
      array_to_string(v_conflicts, '」、「');
  end if;

  update public.orders
    set end_date = v_new_end,
        has_extended = true
    where id = v_order.id;
end;
$$;
