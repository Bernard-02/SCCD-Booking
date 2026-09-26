-- SCCD Booking — 拆單機制：部分歸還（後台）＋部分延期（前台）（情境 5＋8，2026-09-26 定案）
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。前置：schema.sql、orders-rpc.sql、rental-blackouts.sql。
-- 規則：延期介面勾選品項——全選＝整單延期不拆單；部分＝拆子單（單號根單號續流水、parent_order_id 指根單）。
-- 延期用掉整張單的延期權（原單與子單 has_extended 皆 true）；
-- 押金：小單依品項小計拆到子單、大量單押金不拆（全留根單，全數歸還後一次退）。

-- ---------- 1. 拆單欄位 ----------
-- parent_order_id 一律指「根單」；refunded 供部分歸還退押金記錄（後台拆單用，先建欄位）
alter table public.orders add column if not exists parent_order_id bigint references public.orders (id);
alter table public.orders add column if not exists refunded int;

-- ---------- 2. 逐品項撞期檢查（唯讀；前台勾選介面用，僅本人可查）----------
create or replace function public.extend_check(p_rental_number text, p_days int)
returns table (oi_id bigint, oi_name text, extendable boolean)
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_uid is null then
    raise exception '未登入';
  end if;
  select * into v_order from public.orders
    where rental_number = p_rental_number and student_id = v_uid;
  if not found then
    raise exception '查無此訂單';
  end if;

  return query
  select oi.id, oi.name,
    case when oi.item_type = 'equipment' then
      oi.quantity <= coalesce((select e.stock_quantity from public.equipment e where e.id = oi.item_id), 0)
        - coalesce((
            select sum(x.quantity)
            from public.order_items x
            join public.orders o2 on o2.id = x.order_id
            where x.item_type = 'equipment'
              and x.item_id = oi.item_id
              and o2.id <> v_order.id
              and o2.status in ('pending', 'in-progress', 'overdue')
              and o2.start_date <= v_order.end_date + p_days
              and o2.end_date >= v_order.end_date + 1), 0)
    else
      not exists (
        select 1
        from public.order_items x
        join public.orders o2 on o2.id = x.order_id
        where x.item_type in ('space-block', 'classroom')
          and x.item_id = oi.item_id
          and o2.id <> v_order.id
          and o2.status in ('pending', 'in-progress', 'overdue')
          and o2.start_date <= v_order.end_date + p_days
          and o2.end_date >= v_order.end_date + 1)
    end
  from public.order_items oi
  where oi.order_id = v_order.id;
end;
$$;

-- ---------- 3. 後台部分歸還（情境 5-①）：勾選「已歸還」品項——全勾＝整單歸還；部分＝拆子單 ----------
-- 已還品項留原單（結案、寫罰款與經手人）；未還品項拆子單（沿原歸還日、沿用 has_extended 與狀態，
-- 續走逾期／罰款／延期／停權流程）。押金：小單→子單＝未還品項小計、原單 refunded＝退還現金；
-- 大量單→押金不拆（子單 0、全數歸還後一次退，refunded 留空由人工結）。
-- ponytail: 大量單子單 deposit_total = 0，前端罰款 cap 顯示會以 0 計——大單部分歸還後逾期屬罕見案例，人工把關。
drop function if exists public.admin_mark_returned_partial(text, bigint[], integer, text); -- 舊簽名（未帶繳清旗標）
create or replace function public.admin_mark_returned_partial(
  p_rental_number text, p_item_ids bigint[], p_penalty int default 0, p_handler text default null,
  p_penalty_paid boolean default true)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_selected int;
  v_total_items int;
  v_root_id bigint;
  v_root_number text;
  v_suffix int;
  v_child_number text;
  v_child_id bigint;
  v_child_dep int := 0;
begin
  if public.user_role() <> 'admin' then
    raise exception '僅限管理員';
  end if;
  if p_penalty < 0 then
    raise exception '罰款金額不可為負';
  end if;
  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    raise exception '請選擇至少一項已歸還的品項';
  end if;

  select * into v_order from public.orders
    where rental_number = p_rental_number
    for update;
  if not found then
    raise exception '查無此訂單';
  end if;
  if v_order.status not in ('in-progress', 'overdue') then
    raise exception '僅租借中／逾期的訂單可歸還';
  end if;

  select count(*) into v_selected from public.order_items
    where order_id = v_order.id and id = any(p_item_ids);
  if v_selected <> array_length(p_item_ids, 1) then
    raise exception '選取品項與訂單不符';
  end if;
  select count(*) into v_total_items from public.order_items where order_id = v_order.id;

  -- 全勾 → 整單歸還（同 admin_mark_returned）
  if v_selected = v_total_items then
    update public.orders
      set status = 'returned', penalty_total = p_penalty, returned_by = p_handler,
          penalty_paid = case when p_penalty > 0 then p_penalty_paid else true end
      where id = v_order.id;
    insert into public.notifications (student_id, type, title, message, link)
    values (v_order.student_id, 'success', '已歸還',
            '訂單 ' || v_order.rental_number || ' 已完成歸還'
            || case when p_penalty > 0 then '，罰款 NT$ ' || p_penalty else '' end || '。', '/profile');
    return v_order.rental_number;
  end if;

  -- 拆單：未還品項 → 子單（單號根單號續流水，parent_order_id 一律指根單）
  v_root_id := coalesce(v_order.parent_order_id, v_order.id);
  select rental_number into v_root_number from public.orders where id = v_root_id;
  select count(*) + 1 into v_suffix from public.orders where parent_order_id = v_root_id;
  v_child_number := v_root_number || '-' || v_suffix;

  -- 押金：小單依「未還品項」小計拆到子單；大量單不拆
  if v_order.booking_type = 'little' then
    select coalesce(sum(deposit * quantity), 0) into v_child_dep
      from public.order_items
      where order_id = v_order.id and not (id = any(p_item_ids));
    v_child_dep := least(v_child_dep, v_order.deposit_total);
  end if;

  insert into public.orders
    (rental_number, student_id, start_date, end_date, booking_type, status,
     deposit_total, has_extended, parent_order_id, reason, class_name, teacher)
  values
    (v_child_number, v_order.student_id, v_order.start_date, v_order.end_date, v_order.booking_type,
     v_order.status, v_child_dep, v_order.has_extended, v_root_id,
     v_order.reason, v_order.class_name, v_order.teacher)
  returning id into v_child_id;

  update public.order_items set order_id = v_child_id
    where order_id = v_order.id and not (id = any(p_item_ids));

  -- 原單結案：罰款、經手人；小單記退還現金（實收 − 子單押金），大量單留空（全還才退，人工結）
  update public.orders
    set status = 'returned',
        penalty_total = p_penalty,
        returned_by = p_handler,
        penalty_paid = case when p_penalty > 0 then p_penalty_paid else true end,
        refunded = case when v_order.booking_type = 'little'
                        then v_order.deposit_total - v_child_dep else null end
    where id = v_order.id;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_order.student_id, 'success', '部分歸還完成',
          '訂單 ' || v_order.rental_number || ' 已歸還部分品項'
          || case when p_penalty > 0 then '（罰款 NT$ ' || p_penalty || '）' else '' end
          || '；未歸還品項拆為子單 ' || v_child_number || '，歸還日不變（'
          || to_char(v_order.end_date, 'YYYY-MM-DD') || '）。', '/profile');

  return v_child_number;
end;
$$;

-- ---------- 4. 部分延期（全選＝整單延；部分＝拆子單）----------
create or replace function public.extend_my_order_partial(p_rental_number text, p_days int, p_item_ids bigint[])
returns text
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
  v_selected int;
  v_total_items int;
  v_root_id bigint;
  v_root_number text;
  v_suffix int;
  v_child_number text;
  v_child_id bigint;
  v_child_dep int := 0;
begin
  if v_uid is null then
    raise exception '未登入';
  end if;
  if p_days < 1 or p_days > 7 then
    raise exception '延期天數需為 1-7 天';
  end if;
  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    raise exception '請選擇至少一項要延期的品項';
  end if;

  select * into v_order from public.orders
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
  if (now() at time zone 'Asia/Taipei')::date > v_order.end_date - 3 then
    raise exception '延期須在原歸還日前三天提出，已逾期限無法延期';
  end if;

  v_new_end := v_order.end_date + p_days;

  -- 寒暑假封鎖（同 extend_my_order）：延長區間不得跨入封鎖期；admin／staff 不受限
  if public.user_role() = 'student' and exists (
    select 1 from public.rental_blackouts b
    where b.start_date <= v_new_end
      and b.end_date >= v_order.end_date + 1
  ) then
    raise exception '無法延期：延長期間適逢寒暑假封鎖，最後歸還日為放假前一日';
  end if;

  -- 選取品項必須全屬於本單
  select count(*) into v_selected from public.order_items
    where order_id = v_order.id and id = any(p_item_ids);
  if v_selected <> array_length(p_item_ids, 1) then
    raise exception '選取品項與訂單不符';
  end if;
  select count(*) into v_total_items from public.order_items where order_id = v_order.id;

  -- 逐選取品項撞期檢查（設備鎖列，與 extend_my_order 同邏輯）
  for v_item in
    select id, item_type, item_id, name, quantity
    from public.order_items where order_id = v_order.id and id = any(p_item_ids)
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
    else
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
    raise exception '無法延期：「%」於延長期間已被其他訂單預約',
      array_to_string(v_conflicts, '」、「');
  end if;

  -- 全選 → 不拆單，等同整單延期
  if v_selected = v_total_items then
    update public.orders set end_date = v_new_end, has_extended = true where id = v_order.id;
    return v_order.rental_number;
  end if;

  -- 拆單：子單＝延期品項；單號＝根單號續流水；parent_order_id 一律指根單
  v_root_id := coalesce(v_order.parent_order_id, v_order.id);
  select rental_number into v_root_number from public.orders where id = v_root_id;
  select count(*) + 1 into v_suffix from public.orders where parent_order_id = v_root_id;
  v_child_number := v_root_number || '-' || v_suffix;

  -- 押金：小單依品項小計拆到子單；大量單押金不拆（全留根單，全數歸還後一次退）
  if v_order.booking_type = 'little' then
    select coalesce(sum(deposit * quantity), 0) into v_child_dep
      from public.order_items where id = any(p_item_ids);
    v_child_dep := least(v_child_dep, v_order.deposit_total);
  end if;

  insert into public.orders
    (rental_number, student_id, start_date, end_date, booking_type, status,
     deposit_total, has_extended, parent_order_id, reason, class_name, teacher)
  values
    (v_child_number, v_order.student_id, v_order.start_date, v_new_end, v_order.booking_type,
     'in-progress', v_child_dep, true, v_root_id, v_order.reason, v_order.class_name, v_order.teacher)
  returning id into v_child_id;

  update public.order_items set order_id = v_child_id where id = any(p_item_ids);

  -- 原單：延期權用掉（整張單僅乙次）、押金扣掉移到子單的部分
  update public.orders
    set has_extended = true,
        deposit_total = deposit_total - v_child_dep
    where id = v_order.id;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_uid, 'success', '部分延期成功',
          '訂單 ' || v_order.rental_number || ' 部分延期：延期品項拆為子單 ' || v_child_number ||
          '，新歸還日 ' || to_char(v_new_end, 'YYYY-MM-DD') || '；其餘品項照原歸還日歸還。', '/profile');

  return v_child_number;
end;
$$;
