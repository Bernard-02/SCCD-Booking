-- SCCD Booking — 拆單機制：部分歸還（後台）＋部分延期（前台）（情境 5＋8，2026-09-26 定案）
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。前置：schema.sql、orders-rpc.sql、rental-blackouts.sql、equipment-bundles.sql。
-- 規則：延期介面勾選品項——全選＝整單延期不拆單；部分＝拆子單（單號根單號續流水、parent_order_id 指根單）。
-- 延期用掉整張單的延期權（原單與子單 has_extended 皆 true）；
-- 押金一律不拆（2026-11-08 Bernard 定）：全留根單，原單＋子單都還完才在「退押金」一次結，不開放還多少退多少。

-- ---------- 1. 拆單欄位 ----------
-- parent_order_id 一律指「根單」；refunded＝退押金結算時退了多少（null＝還沒結）
alter table public.orders add column if not exists parent_order_id bigint references public.orders (id);
alter table public.orders add column if not exists refunded int;
-- returned_at：實際按歸還的時間，退押金時用來試算逾期罰款（不然日子會一直往後滾）
alter table public.orders add column if not exists returned_at timestamptz;
-- 加這欄之前歸還的押金 0 單沒有東西要結，不要跑進「待退押金」
update public.orders set refunded = 0
  where status = 'returned' and deposit_total = 0 and refunded is null and parent_order_id is null and returned_at is null;

drop function if exists public.split_settled_deposit(bigint, bigint[]); -- 押金不再依品項拆

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
-- 已還品項留原單（結案、記經手人與歸還時間）；未還品項拆子單（沿原歸還日、沿用 has_extended 與狀態，
-- 續走逾期／延期／停權流程）。這裡只記東西回來了，押金與罰金在 admin_refund_deposit 一次結。
drop function if exists public.admin_mark_returned_partial(text, bigint[], integer, text);          -- 舊簽名
drop function if exists public.admin_mark_returned_partial(text, bigint[], integer, text, boolean); -- 舊簽名（歸還時填罰款）
create or replace function public.admin_mark_returned_partial(
  p_rental_number text, p_item_ids bigint[], p_handler text default null)
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
begin
  p_handler := public.operator_handler(p_handler); -- 值班：admin 或學會成員（operator-access.sql）
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
      set status = 'returned', returned_by = p_handler, returned_at = now()
      where id = v_order.id;
    insert into public.notifications (student_id, type, title, message, link)
    values (v_order.student_id, 'success', '已歸還',
            '訂單 ' || v_order.rental_number || ' 已完成歸還。', '/profile');
    return v_order.rental_number;
  end if;

  -- 拆單：未還品項 → 子單（單號根單號續流水，parent_order_id 一律指根單）
  v_root_id := coalesce(v_order.parent_order_id, v_order.id);
  select rental_number into v_root_number from public.orders where id = v_root_id;
  select count(*) + 1 into v_suffix from public.orders where parent_order_id = v_root_id;
  v_child_number := v_root_number || '-' || v_suffix;

  insert into public.orders
    (rental_number, student_id, start_date, end_date, booking_type, status,
     deposit_total, has_extended, parent_order_id, reason, class_name, teacher, as_teacher, proof_path)
  values
    (v_child_number, v_order.student_id, v_order.start_date, v_order.end_date, v_order.booking_type,
     v_order.status, 0, v_order.has_extended, v_root_id,
     v_order.reason, v_order.class_name, v_order.teacher, v_order.as_teacher, v_order.proof_path)
  returning id into v_child_id;

  update public.order_items set order_id = v_child_id
    where order_id = v_order.id and not (id = any(p_item_ids));

  update public.orders
    set status = 'returned', returned_by = p_handler, returned_at = now()
    where id = v_order.id;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_order.student_id, 'success', '部分歸還完成',
          '訂單 ' || v_order.rental_number || ' 已歸還部分品項；未歸還品項拆為子單 ' || v_child_number || '，歸還日不變（'
          || to_char(v_order.end_date, 'YYYY-MM-DD') || '）。押金等全部歸還後一次結算。', '/profile');

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

  insert into public.orders
    (rental_number, student_id, start_date, end_date, booking_type, status,
     deposit_total, has_extended, parent_order_id, reason, class_name, teacher, as_teacher, proof_path)
  values
    (v_child_number, v_order.student_id, v_order.start_date, v_new_end, v_order.booking_type,
     'in-progress', 0, true, v_root_id, v_order.reason, v_order.class_name, v_order.teacher,
     v_order.as_teacher, v_order.proof_path)
  returning id into v_child_id;

  update public.order_items set order_id = v_child_id where id = any(p_item_ids);

  -- 原單：延期權用掉（整張單僅乙次）
  update public.orders set has_extended = true where id = v_order.id;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_uid, 'success', '部分延期成功',
          '訂單 ' || v_order.rental_number || ' 部分延期：延期品項拆為子單 ' || v_child_number ||
          '，新歸還日 ' || to_char(v_new_end, 'YYYY-MM-DD') || '；其餘品項照原歸還日歸還。', '/profile');

  return v_child_number;
end;
$$;

-- ---------- 5. 退押金＝結算（2026-11-08 Bernard 定）----------
-- 學會在這裡填罰金（逾期、損壞、遺失，系統不知道狀況），押金扣掉罰金退給學生。
-- 罰金超過押金：退 0，差額要學生繳（penalty_paid＝false，擋新單），後台「收罰款」收清這張單才算結束。
-- 整張單（根單＋子單）都還完才能結，押金加總回根單；已繳押金的取消單也走這裡（沒有罰金）。
drop function if exists public.admin_refund_deposit(text, text); -- 舊簽名（未帶罰金）
create or replace function public.admin_refund_deposit(p_rental_number text, p_penalty int, p_handler text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_deposit int;
  v_refund int;
  v_owed int;
begin
  p_handler := public.operator_handler(p_handler); -- 值班：admin 或學會成員（operator-access.sql）
  if p_penalty is null or p_penalty < 0 then
    raise exception '罰款金額不可為負';
  end if;

  select * into v_order from public.orders
    where rental_number = p_rental_number and parent_order_id is null and refunded is null
      and (status = 'returned' or (status = 'canceled' and deposit_paid_at is not null and deposit_total > 0))
    for update;
  if not found then
    raise exception '此訂單沒有待退的押金';
  end if;
  if v_order.status = 'canceled' and p_penalty > 0 then
    raise exception '取消的訂單不能填罰款';
  end if;
  if exists (select 1 from public.orders where parent_order_id = v_order.id and status in ('pending', 'in-progress', 'overdue')) then
    raise exception '還有子單沒歸還，全部還完才能退押金';
  end if;

  -- 子單平常押金 0；點交時學會另收的押金記在子單上，一起算回根單
  select sum(deposit_total) into v_deposit from public.orders
    where id = v_order.id or parent_order_id = v_order.id;
  v_refund := greatest(v_deposit - p_penalty, 0);
  v_owed := greatest(p_penalty - v_deposit, 0);

  update public.orders set deposit_total = 0 where parent_order_id = v_order.id and deposit_total <> 0;
  update public.orders
    set deposit_total = v_deposit, penalty_total = p_penalty, penalty_paid = (v_owed = 0),
        refunded = v_refund, refunded_by = p_handler
    where id = v_order.id;

  if v_owed > 0 then
    insert into public.notifications (student_id, type, title, message, link)
    values (v_order.student_id, 'warning', '請繳清罰款',
            '訂單 ' || p_rental_number || ' 罰款 NT$ ' || p_penalty || '，押金 NT$ ' || v_deposit
            || ' 抵扣後還要繳 NT$ ' || v_owed || '，請至系學會繳清；繳清前無法預約。', '/profile');
  elsif v_deposit > 0 then
    insert into public.notifications (student_id, type, title, message, link)
    values (v_order.student_id, 'success', '押金已退還',
            '訂單 ' || p_rental_number || ' 的押金已退還 NT$ ' || v_refund
            || case when p_penalty > 0 then '（已扣罰款 NT$ ' || p_penalty || '）' else '' end || '。', '/profile');
  end if;
end;
$$;

notify pgrst, 'reload schema';
