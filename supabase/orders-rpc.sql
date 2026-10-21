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
  v_is_equip boolean;     -- 本單為設備單（分單後一張單全設備或全空間）
  v_open text;            -- 同類型未歸還單的單號（同類型限一單）
  v_today date := (now() at time zone 'Asia/Taipei')::date;
  v_total int;            -- 本單件數（設備算數量、空間每格 1）
  v_dep int;              -- 單價（從資料表讀，不信任前端）
  v_active boolean;
begin
  if v_uid is null then
    raise exception '未登入';
  end if;
  -- 停權檢查（情境 7）：未完成清潔歸還者不可再使用預約系統（擋送單，不擋登入）
  if (select account_level from public.students where id = v_uid) >= 5 then
    raise exception '帳號已停權（未完成清潔歸還），無法送出預約，請聯絡系學會';
  end if;
  -- 休學擋單（2026-10-01，後台會員管理標記；欄位見 members.sql）：同停權，只擋新借
  if (select on_leave from public.students where id = v_uid) then
    raise exception '帳號目前標記為休學，暫停租借；復學後請洽系學會恢復';
  end if;
  -- 已畢業（2026-10-04，後台手動標記；欄位見 members.sql）：不能再借。有東西沒還的仍可登入處理歸還
  if (select graduated from public.students where id = v_uid) then
    raise exception '帳號已停用（已畢業），無法送出預約';
  end if;
  -- 罰款欠繳擋單（情境 13，2026-09-26）：有未繳清的逾期罰款者不可再下單（僅擋 student）
  if public.user_role() = 'student' and exists (
    select 1 from public.orders
    where student_id = v_uid and coalesce(penalty_total, 0) > 0 and penalty_paid = false
  ) then
    raise exception '有未繳清的逾期罰款，請先至系學會繳清後再預約';
  end if;
  if p_orders is null or jsonb_array_length(p_orders) = 0 then
    raise exception '沒有可送出的訂單';
  end if;

  -- 年級慣例：'2'/'3'/'4' 或含「大二/大三/大四/碩」字樣視為大二以上，其餘（含未填）從嚴視為大一
  select grade into v_grade from public.students where id = v_uid;
  v_sophomore_up := coalesce(v_grade, '') ~ '^[234]$'
                 or coalesce(v_grade, '') ~ '(大二|大三|大四|碩)';

  for v_order in select * from jsonb_array_elements(p_orders) loop
    -- 寒暑假封鎖（情境 11-a）：學生的租借區間與任一封鎖區間重疊即擋；admin／staff 不受限。
    if public.user_role() = 'student' and exists (
      select 1 from public.rental_blackouts b
      where b.start_date <= (v_order ->> 'end_date')::date
        and b.end_date >= (v_order ->> 'start_date')::date
    ) then
      raise exception '所選租借期間為寒暑假封鎖期，暫不開放租借';
    end if;

    -- 設備／空間分單（rental-rules 新規則 4，2026-10-02 實作）：一張單只能全是設備或全是空間
    if (select count(distinct (i ->> 'item_type' = 'equipment'))
          from jsonb_array_elements(v_order -> 'items') i) > 1 then
      raise exception '設備與空間須分開成兩張訂單';
    end if;
    v_is_equip := (v_order -> 'items' -> 0 ->> 'item_type') = 'equipment';

    -- 基本規則（2026-10-04 補 server 端，原僅前端）：類型配對、數量、日期、天數上限
    if v_order ->> 'booking_type' not in ('little', case when v_is_equip then 'mass-personal' else 'mass-group' end) then
      raise exception '訂單類型不符';
    end if;
    if exists (select 1 from jsonb_array_elements(v_order -> 'items') i
               where coalesce((i ->> 'quantity')::int, 0) < 1
                  or (i ->> 'item_type' <> 'equipment' and (i ->> 'quantity')::int <> 1)) then
      raise exception '數量需為正整數';
    end if;
    if (select count(distinct i ->> 'item_id') from jsonb_array_elements(v_order -> 'items') i)
       <> jsonb_array_length(v_order -> 'items') then
      raise exception '品項重複';
    end if;
    select sum((i ->> 'quantity')::int) into v_total from jsonb_array_elements(v_order -> 'items') i;
    if v_is_equip and v_order ->> 'booking_type' = 'little' and v_total > 9 then
      raise exception '小量訂單最多 9 件（目前 % 件）', v_total;
    end if;
    if v_order ->> 'booking_type' <> 'little' and v_total < 10 then
      raise exception '大量／團體訂單需滿 10 件（目前 % 件）', v_total;
    end if;
    if (v_order ->> 'start_date')::date < v_today
       or (v_order ->> 'end_date')::date < (v_order ->> 'start_date')::date then
      raise exception '租借日期不正確，請重新選擇';
    end if;
    if v_is_equip and v_order ->> 'booking_type' = 'mass-personal'
       and (v_order ->> 'start_date')::date < v_today + 3 then
      raise exception '大量設備需於 3 天前預約';
    end if;
    -- 天數上限同前端 Calendar（迄日－起日）：設備 30、空間 14（大四／碩士 30，同 gradeUtils.isSeniorOrGraduate）
    if (v_order ->> 'end_date')::date - (v_order ->> 'start_date')::date >
       case when v_is_equip or coalesce(v_grade, '') ~ '^4$' or coalesce(v_grade, '') ~ '(大四|碩)'
            then 30 else 14 end then
      raise exception '租借天數超過上限';
    end if;

    -- 重複下單檢查（rental-rules §6，原僅前端）：同一時段同類別（設備／空間）僅能有一張小量訂單
    if v_order ->> 'booking_type' = 'little' and exists (
      select 1 from public.orders o
      where o.student_id = v_uid
        and o.booking_type = 'little'
        and o.status in ('pending', 'in-progress', 'overdue')
        and o.start_date = (v_order ->> 'start_date')::date
        and o.end_date = (v_order ->> 'end_date')::date
        and exists (select 1 from public.order_items oi
                    where oi.order_id = o.id and oi.item_type = 'equipment') = v_is_equip
    ) then
      raise exception '該時段已有一張%訂單（同一時段同類僅能有一張）',
        case when v_is_equip then '小量設備' else '個人空間' end;
    end if;

    -- 同類型限一單（rental-rules 新規則 7，2026-10-02 實作）：學會規定上一張歸還後才能開下一張。
    -- 同類型＝小量設備／大量設備／個人空間／團體空間四格；未歸還＝pending／in-progress／overdue
    -- （returned／canceled 才算結案，含拆單的子單）。同次送出的多張單也會互擋（前一張已寫入本 transaction）。
    -- 僅擋 student（系秘／助教直借不受限）；購物車層 useCart 另擋同類別第二個時段（UX）。
    if public.user_role() = 'student' then
      select o.rental_number into v_open
        from public.orders o
        where o.student_id = v_uid
          and o.status in ('pending', 'in-progress', 'overdue')
          and (o.booking_type = 'little') = (v_order ->> 'booking_type' = 'little')
          and exists (select 1 from public.order_items oi
                      where oi.order_id = o.id and oi.item_type = 'equipment') = v_is_equip
        limit 1;
      if v_open is not null then
        raise exception '您已有一張未歸還的%訂單（%），需歸還後才能再借同類型',
          case when v_is_equip
            then case when v_order ->> 'booking_type' = 'little' then '小量設備' else '大量設備' end
            else case when v_order ->> 'booking_type' = 'little' then '個人空間' else '團體空間' end
          end,
          v_open;
      end if;
    end if;

    -- 大量設備預選繳押金／取件時段（新規則 3，見 mass-pickup.sql）。
    -- ponytail: 時段是否為值班時段、是否在 24 工作時內由前端選單把關；這裡只守必填與日期範圍
    --（選錯時段只影響學生自己，逾時未繳仍由 auto-cancel 取消）
    if v_is_equip and v_order ->> 'booking_type' = 'mass-personal' then
      if coalesce(v_order ->> 'deposit_slot', '') = '' or coalesce(v_order ->> 'pickup_slot', '') = ''
         or v_order ->> 'deposit_date' is null then
        raise exception '大量設備訂單需選擇繳押金與取件時段';
      end if;
      if (v_order ->> 'deposit_date')::date < (now() at time zone 'Asia/Taipei')::date
         or (v_order ->> 'deposit_date')::date > (v_order ->> 'start_date')::date then
        raise exception '繳押金日期需介於今天與起租日之間，請重新選擇時段';
      end if;
    end if;

    -- 庫存檢查：鎖定設備列（for update），避免兩人同時搶最後一件。
    -- 佔用 = 生效訂單（pending / in-progress / overdue）中與本時段重疊的數量
    -- 押金於伺服器端計算：單價一律讀資料表（不信任前端傳值），設備／空間各 cap 5,000
    v_equip_dep := 0;
    v_space_dep := 0;
    for v_item in select * from jsonb_array_elements(v_order -> 'items') loop
      if v_item ->> 'item_type' = 'equipment' then
        select stock_quantity, deposit, is_active into v_stock, v_dep, v_active
          from public.equipment
          where id = v_item ->> 'item_id'
          for update;
        if not found then
          raise exception '設備不存在：%', v_item ->> 'name';
        end if;
        if not v_active then
          raise exception '「%」已下架，請從購物車移除', v_item ->> 'name';
        end if;
        v_equip_dep := v_equip_dep + v_dep * (v_item ->> 'quantity')::int;

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
        select deposit, is_active into v_dep, v_active from public.space
          where id = v_item ->> 'item_id'
          for update;
        if not found then
          raise exception '空間不存在：%', v_item ->> 'name';
        end if;
        if not v_active then
          raise exception '「%」目前未開放，請從購物車移除', v_item ->> 'name';
        end if;
        v_space_dep := v_space_dep + v_dep;

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
      else
        raise exception '品項類型不正確';
      end if;
    end loop;

    v_equip_dep := least(v_equip_dep, 5000);
    v_space_dep := least(v_space_dep, 5000);

    -- 助教直借（情境 10，2026-09-26 實作）：staff 免押金、送出即 in-progress（免審核）；仍守先來後到
    if public.user_role() = 'staff' then
      v_equip_dep := 0;
      v_space_dep := 0;
    end if;

    -- 流水號：當年度訂單數 + 1（每年重置）。同秒併發撞號時
    -- rental_number 的 unique constraint 會讓整筆交易失敗，前端重送即可（系上規模足夠）
    select count(*) + 1 into v_seq
      from public.orders
      where rental_number like '#' || v_year || '%';
    v_rental := '#' || v_year || lpad(v_seq::text, 3, '0');

    insert into public.orders
      (rental_number, student_id, start_date, end_date, booking_type, status,
       deposit_total, reason, class_name, teacher, deposit_date, deposit_slot, pickup_slot)
    values
      (v_rental, v_uid,
       (v_order ->> 'start_date')::date, (v_order ->> 'end_date')::date,
       v_order ->> 'booking_type',
       case when public.user_role() = 'staff' then 'in-progress' else 'pending' end,
       v_equip_dep + v_space_dep,
       v_order ->> 'reason', v_order ->> 'class_name', v_order ->> 'teacher',
       (v_order ->> 'deposit_date')::date, v_order ->> 'deposit_slot', v_order ->> 'pickup_slot')
    returning id into v_order_id;

    insert into public.order_items (order_id, item_type, item_id, name, quantity, deposit)
    select v_order_id,
           i ->> 'item_type',
           i ->> 'item_id',
           i ->> 'name',
           (i ->> 'quantity')::int,
           case when i ->> 'item_type' = 'equipment'
             then (select e.deposit from public.equipment e where e.id = i ->> 'item_id')
             else (select s.deposit from public.space s where s.id = i ->> 'item_id') end
    from jsonb_array_elements(v_order -> 'items') i;

    insert into public.notifications (student_id, type, title, message, link)
    values (v_uid, 'success', '預約成功',
            case when public.user_role() = 'staff'
              then '訂單 ' || v_rental || ' 已成立（助教直借，免押金）。'
              else '訂單 ' || v_rental || ' 已送出，請於 24 小時內繳交押金。' end, '/profile');

    v_numbers := v_numbers || v_rental;
  end loop;

  return v_numbers;
end;
$$;

-- 後台：收押金／取件。僅 admin（情境 4；大量設備預繳見 mass-pickup.sql）。
--   p_pickup = true（預設）：收押金＋取件同時進行，或已預繳者來取件 → in-progress，租借開始。
--   p_pickup = false：只收押金（大量設備先繳後取）→ 仍為 pending，記 deposit_paid_at（＝已繳待取件）。
-- p_handler = 值班經手幹部姓名（快照：收押金寫 paid_by、取件寫 picked_up_by；名單見 staff-members.sql）。
-- p_deposit_total = 已繳待取件的單在繳押金後被學生改過品項時，學會現場補收／退還後的押金總額（null＝不變）。
drop function if exists public.admin_mark_paid(text);                -- 舊簽名（未帶經手人）
drop function if exists public.admin_mark_paid(text, text);          -- 舊簽名（未帶取件選項）
drop function if exists public.admin_mark_paid(text, text, boolean); -- 舊簽名（未帶押金調整）
create or replace function public.admin_mark_paid(
  p_rental_number text, p_handler text default null, p_pickup boolean default true,
  p_deposit_total int default null)
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
    where rental_number = p_rental_number and status = 'pending'
    for update;
  if not found then
    raise exception '訂單不存在或非待繳押金／待取件狀態';
  end if;
  if not p_pickup and v_order.deposit_paid_at is not null then
    raise exception '此訂單已收過押金，請改按「取件」';
  end if;
  if p_deposit_total < 0 then
    raise exception '押金金額不可為負';
  end if;

  -- set 內引用的欄位皆為更新前的值
  update public.orders
    set status = case when p_pickup then 'in-progress' else 'pending' end,
        deposit_paid_at = coalesce(deposit_paid_at, now()),
        deposit_total = coalesce(p_deposit_total, deposit_total),
        paid_by = case when deposit_paid_at is null then p_handler else paid_by end,
        picked_up_by = case when p_pickup then p_handler else picked_up_by end
    where id = v_order.id;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_order.student_id, 'success',
          case when p_pickup then '租借開始' else '押金已確認' end,
          '訂單 ' || p_rental_number ||
          case when p_pickup then
                 case when v_order.deposit_paid_at is null then ' 押金已收並完成取件，租借開始。'
                      else ' 已完成取件，租借開始。' end
               else ' 押金已收，請於 ' || to_char(v_order.start_date, 'MM/DD') || ' '
                    || coalesce(v_order.pickup_slot, '值班時段') || ' 取件。' end,
          '/profile');
end;
$$;

-- 後台整單歸還已改走 admin_mark_returned_partial（partial-extend.sql，全勾＝整單），舊版移除（2026-10-04）
drop function if exists public.admin_mark_returned(text, integer);
drop function if exists public.admin_mark_returned(text, integer, text);

-- 查詢設備在指定時段的佔用量（給型錄顯示可借數量；只回傳統計，不含個資）
-- reserved = pending + in-progress + overdue 的重疊訂單數量；on_hold = 其中押金還沒繳的部分
--   （待繳押金的單＋小量單取件後新增、尚未點交補押金的品項；已繳待取件與大量單取件後新增＝押金已繳，直接扣）
--   pickup_pending 欄位見 modify-order.sql（需先執行）
create or replace function public.equipment_reserved(p_start date, p_end date)
returns table(item_id text, reserved bigint, on_hold bigint)
language sql
security definer set search_path = public
stable
as $$
  select oi.item_id,
         sum(oi.quantity)::bigint as reserved,
         coalesce(sum(oi.quantity) filter (
           where (o.status = 'pending' and o.deposit_paid_at is null)
              or (oi.pickup_pending and o.booking_type = 'little')
         ), 0)::bigint as on_hold
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

-- 學生延期已改走 extend_my_order_partial（partial-extend.sql，全勾＝整單延，含撞期／封鎖檢查），舊版移除（2026-10-04）
drop function if exists public.extend_my_order(text, integer);
