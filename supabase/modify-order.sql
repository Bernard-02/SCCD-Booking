-- SCCD Booking — 學生修改已送出的設備訂單（order-lifecycle 情境 3，2026-10-03 Bernard 定案）
-- 小量／大量設備單都改「原單」，不另開新單（同類型限一單：忘了加的設備直接加進現有那張）。
--   取件前（待繳押金／已繳待取件）：可加、可減、可改數量，以最新為準；改過的品項記 changed_at（不分加減）
--   取件後（租借中）：只能加——不需要的設備到期一起歸還即可。新增的品項記 pickup_pending（待點交），
--     學會點交（admin_handover_items）後清除；未點交前仍佔庫存，超過 24 工作時未領自動取消（比照情境 1）
-- 數量：小量總數 ≤ 9、大量 ≥ 10；數量變多的品項逐項查庫存（同 submit_orders）
-- 押金：尚未繳押金的單由 server 依最新品項重算；已繳（已繳待取件／租借中）不動——
--   差額由學會現場計算，點交（admin_handover_items）或取件（admin_mark_paid 的 p_deposit_total）時記錄
-- 使用方式：先執行本檔，再重貼 orders-rpc.sql（equipment_reserved 的 on_hold 需要 pickup_pending 欄位）；
--   需先有 auto-cancel.sql 的 business_hours_since 與 pg_cron（已執行過）

alter table public.order_items add column if not exists changed_at timestamptz;                         -- 送單後學生加／改過
alter table public.order_items add column if not exists pickup_pending boolean not null default false; -- 取件後新增、尚未點交
alter table public.order_items add column if not exists handed_over_by text;                           -- 新增品項點交經手（姓名快照）
alter table public.orders add column if not exists items_updated_at timestamptz;                       -- 學生最後一次改品項

-- ---------- 學生：修改品項 ----------
-- p_items＝改完後的完整設備清單 [{item_id, quantity}]（不在清單內＝移除，取件後不可移除已點交的）
create or replace function public.modify_my_order(p_rental_number text, p_items jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
  v_picked boolean; -- 已取件（租借中）：只能加
  v_item jsonb;
  v_id text;
  v_qty int;
  v_cur int;        -- 本單目前數量（含待點交）
  v_held int;       -- 已點交數量（取件後不可低於此）
  v_total int;
  v_reserved int;
  v_since timestamptz; -- 待點交列的起算時間（24 工作時未領自動取消）
  v_eq public.equipment%rowtype;
begin
  if v_uid is null then
    raise exception '未登入';
  end if;
  if (select account_level from public.students where id = v_uid) >= 5 then
    raise exception '帳號已停權（未完成清潔歸還），無法修改訂單，請聯絡系學會';
  end if;
  if (select on_leave from public.students where id = v_uid) then
    raise exception '帳號目前標記為休學，暫停租借；復學後請洽系學會恢復';
  end if;

  select * into v_order from public.orders
    where rental_number = p_rental_number and student_id = v_uid
    for update;
  if not found then
    raise exception '查無此訂單';
  end if;
  if v_order.status not in ('pending', 'in-progress') then
    raise exception '僅待繳押金、已繳待取件、租借中的訂單可修改（逾期請先歸還）';
  end if;
  if v_order.booking_type not in ('little', 'mass-personal') or exists (
    select 1 from public.order_items where order_id = v_order.id and item_type <> 'equipment'
  ) then
    raise exception '僅設備訂單可修改品項';
  end if;
  v_picked := v_order.status = 'in-progress';

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception '訂單至少需保留一項設備';
  end if;
  if (select count(distinct i ->> 'item_id') from jsonb_array_elements(p_items) i) <> jsonb_array_length(p_items) then
    raise exception '品項重複';
  end if;
  select coalesce(sum((i ->> 'quantity')::int), 0) into v_total from jsonb_array_elements(p_items) i;
  if v_order.booking_type = 'little' and v_total > 9 then
    raise exception '小量訂單最多 9 件（目前 % 件）', v_total;
  end if;
  if v_order.booking_type = 'mass-personal' and v_total < 10 then
    raise exception '大量訂單需滿 10 件（目前 % 件）', v_total;
  end if;

  -- 取件後只能加：已點交的設備不可移除或減少
  if v_picked and exists (
    select 1 from public.order_items oi
    where oi.order_id = v_order.id and not oi.pickup_pending
    group by oi.item_id
    having sum(oi.quantity) > coalesce((
      select max((i ->> 'quantity')::int) from jsonb_array_elements(p_items) i where i ->> 'item_id' = oi.item_id
    ), 0)
  ) then
    raise exception '已取件的設備不能減少（不需要的到期一起歸還即可）';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_id := v_item ->> 'item_id';
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then
      raise exception '數量需為正整數';
    end if;

    select coalesce(sum(quantity), 0) into v_cur
      from public.order_items where order_id = v_order.id and item_id = v_id;
    continue when v_qty = v_cur;

    -- 鎖設備列（同 submit_orders），避免兩人同時搶最後一件
    select * into v_eq from public.equipment where id = v_id for update;
    if not found then
      raise exception '設備不存在：%', v_id;
    end if;

    if v_qty > v_cur then
      if v_cur = 0 and not v_eq.is_active then
        raise exception '「%」已下架，無法新增', v_eq.name;
      end if;
      select coalesce(sum(oi.quantity), 0) into v_reserved
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where oi.item_type = 'equipment'
          and oi.item_id = v_id
          and o.id <> v_order.id
          and o.status in ('pending', 'in-progress', 'overdue')
          and o.start_date <= v_order.end_date
          and o.end_date >= v_order.start_date;
      if v_qty > v_eq.stock_quantity - v_reserved then
        raise exception '「%」該時段庫存不足（最多可借 %）',
          v_eq.name, greatest(v_eq.stock_quantity - v_reserved, 0);
      end if;
    end if;

    if v_picked then
      -- 取件後：已點交的列不動，超出的數量放在一列「待點交」（每次改都重寫這列）。
      -- 計時沿用第一次新增的時間：之後再改數量不重設 24 工作時，避免一直改單續佔庫存
      select coalesce(sum(quantity), 0) into v_held
        from public.order_items where order_id = v_order.id and item_id = v_id and not pickup_pending;
      select min(changed_at) into v_since
        from public.order_items where order_id = v_order.id and item_id = v_id and pickup_pending;
      delete from public.order_items where order_id = v_order.id and item_id = v_id and pickup_pending;
      if v_qty > v_held then
        insert into public.order_items (order_id, item_type, item_id, name, quantity, deposit, changed_at, pickup_pending)
        values (v_order.id, 'equipment', v_id, v_eq.name, v_qty - v_held, v_eq.deposit, coalesce(v_since, now()), true);
      end if;
    else
      -- 取件前：直接改成最新數量
      update public.order_items set quantity = v_qty, changed_at = now()
        where order_id = v_order.id and item_id = v_id;
      if not found then
        insert into public.order_items (order_id, item_type, item_id, name, quantity, deposit, changed_at)
        values (v_order.id, 'equipment', v_id, v_eq.name, v_qty, v_eq.deposit, now());
      end if;
    end if;
  end loop;

  -- 移除不在清單內的品項（取件後只會刪到「待點交」的列；已點交的上面已擋）
  delete from public.order_items oi
    where oi.order_id = v_order.id
      and (not v_picked or oi.pickup_pending)
      and not exists (select 1 from jsonb_array_elements(p_items) i where i ->> 'item_id' = oi.item_id);

  -- 尚未繳押金：依最新品項重算（同 submit_orders：cap 5,000、staff 免押金）；已繳的差額由學會現場處理
  update public.orders
    set items_updated_at = now(),
        deposit_total = case
          when status = 'pending' and deposit_paid_at is null then
            case when public.user_role() = 'staff' then 0
                 else least((select coalesce(sum(deposit * quantity), 0) from public.order_items where order_id = v_order.id), 5000)
            end
          else deposit_total
        end
    where id = v_order.id;
end;
$$;

-- ---------- 後台：點交取件後新增的品項 ----------
-- p_deposit_total＝點交後該單的押金總額（學會現場計算後填入；系統只記錄，前端預填建議值）
create or replace function public.admin_handover_items(p_rental_number text, p_handler text, p_deposit_total int)
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
  if p_deposit_total is null or p_deposit_total < 0 then
    raise exception '押金金額不可為負';
  end if;

  select * into v_order from public.orders
    where rental_number = p_rental_number and status in ('in-progress', 'overdue')
    for update;
  if not found then
    raise exception '訂單不存在或非租借中';
  end if;

  update public.order_items
    set pickup_pending = false, handed_over_by = p_handler
    where order_id = v_order.id and pickup_pending;
  if not found then
    raise exception '此訂單沒有待點交的新增品項';
  end if;

  update public.orders set deposit_total = p_deposit_total where id = v_order.id;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_order.student_id, 'success', '新增設備已點交',
          '訂單 ' || p_rental_number || ' 新增的設備已點交'
          || case when p_deposit_total <> v_order.deposit_total
                  then '，押金調整為 NT$ ' || p_deposit_total else '' end || '。',
          '/profile');
end;
$$;

-- ---------- 新增未領自動取消（比照情境 1：24 工作時）----------
-- 取件後新增的品項超過 24 工作時仍未點交 → 刪除該列（釋放庫存）＋通知，原有設備不受影響。
-- 起算＝該品項第一次新增的時間（changed_at，見上方 modify_my_order）。回傳發出通知的訂單數。
create or replace function public.cancel_expired_additions()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    delete from public.order_items oi
     using public.orders o
     where o.id = oi.order_id
       and oi.pickup_pending
       and public.business_hours_since(oi.changed_at) > 24
     returning o.id, o.rental_number, o.student_id, oi.name
  )
  insert into public.notifications (student_id, type, title, message, link)
  select student_id, 'warning', '新增設備已取消',
         '訂單 ' || rental_number || ' 新增的「' || string_agg(name, '」、「') ||
         '」因逾時未領取已自動取消，原有設備不受影響。',
         '/profile'
  from expired
  group by id, rental_number, student_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- pg_cron 每 5 分鐘掃一次（同名 schedule 重複執行會直接覆蓋，可重複跑）
create extension if not exists pg_cron;
select cron.schedule('cancel-expired-additions', '*/5 * * * *',
  $$select public.cancel_expired_additions()$$);
