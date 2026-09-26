-- SCCD Booking — 後台日常操作三連發（情境 2／9，2026-09-26）
-- 代取消、代客延期、解除停權。使用方式：SQL Editor 貼上執行一次（可重複執行）。

-- ---------- 1. 經手人追溯欄位 ----------
alter table public.orders add column if not exists canceled_by text; -- 代取消經手幹部
alter table public.orders add column if not exists extended_by text; -- 代延期經手幹部（學生自助延期不寫）

-- ---------- 2. 代取消（情境 2：學生到學會現場辦，涉及退押金）----------
-- pending（還沒繳錢，直接作廢）與 in-progress（已繳押金，現金退還為人工動作）皆可；
-- canceled 不佔用，庫存／空間自動釋放。overdue 不可取消（要走歸還＋罰款）。
create or replace function public.admin_cancel_order(p_rental_number text, p_handler text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if public.user_role() <> 'admin' then
    raise exception '僅限管理員';
  end if;

  select * into v_order from public.orders
    where rental_number = p_rental_number for update;
  if not found then
    raise exception '查無此訂單';
  end if;
  if v_order.status not in ('pending', 'in-progress') then
    raise exception '僅待繳押金／租借中的訂單可取消（逾期單請走歸還＋罰款）';
  end if;

  update public.orders
    set status = 'canceled', canceled_by = p_handler
    where id = v_order.id;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_order.student_id, 'info', '訂單已取消',
          '訂單 ' || v_order.rental_number || ' 已由系學會協助取消'
          || case when v_order.status = 'in-progress'
                  then '，押金 NT$ ' || v_order.deposit_total || ' 已退還' else '' end || '。', '/profile');
end;
$$;

-- ---------- 3. 代客延期（情境 9.2：不受「僅乙次」與前三天限制）----------
-- 仍守先來後到（撞期照擋，admin 要協調請先處理衝突訂單）；封鎖期不擋（admin 自行判斷）。
-- 不動 has_extended（學生自己的延期權不受影響）；overdue 單延期後回到 in-progress（老師通融情境）。
-- 每次 1-7 天；需要更長 admin 可分多次延（無次數限制）。
create or replace function public.admin_extend_order(p_rental_number text, p_days int, p_handler text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_new_end date;
  v_item record;
  v_stock int;
  v_reserved int;
  v_conflicts text[] := '{}';
begin
  if public.user_role() <> 'admin' then
    raise exception '僅限管理員';
  end if;
  if p_days < 1 or p_days > 7 then
    raise exception '延期天數需為 1-7 天（更長請分次延）';
  end if;

  select * into v_order from public.orders
    where rental_number = p_rental_number for update;
  if not found then
    raise exception '查無此訂單';
  end if;
  if v_order.status not in ('in-progress', 'overdue') then
    raise exception '僅租借中／逾期的訂單可延期';
  end if;

  v_new_end := v_order.end_date + p_days;

  -- 撞期檢查（與 extend_my_order 同邏輯；先來後到不可破）
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
    raise exception '無法延期：「%」於延長期間已被其他訂單預約，請先協調該訂單',
      array_to_string(v_conflicts, '」、「');
  end if;

  update public.orders
    set end_date = v_new_end,
        status = 'in-progress', -- overdue 經協調延期後回到租借中
        extended_by = p_handler
    where id = v_order.id;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_order.student_id, 'success', '延期成功',
          '訂單 ' || v_order.rental_number || ' 已由系學會協助延期 ' || p_days ||
          ' 天，新歸還日 ' || to_char(v_new_end, 'YYYY-MM-DD') || '。', '/profile');
end;
$$;

-- ---------- 4. 解除停權（情境 7：sticky 停權的人工解鎖；繳清／老師通融）----------
create or replace function public.admin_unsuspend_student(p_student_id text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid;
begin
  if public.user_role() <> 'admin' then
    raise exception '僅限管理員';
  end if;

  update public.students
    set account_level = 0, overdue_days = 0
    where student_id = p_student_id and account_level >= 5
    returning id into v_uid;
  if not found then
    raise exception '查無此學號或帳號並未停權';
  end if;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_uid, 'success', '停權已解除',
          '您的帳號停權已由系學會解除，可正常使用預約系統。', '/profile');
end;
$$;
