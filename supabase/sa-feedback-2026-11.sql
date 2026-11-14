-- =============================================================
-- 2026-11-14 學會測試後的調整：學生自行取消、訂單封存、學會成員唯讀看會員管理、雷切機分午班／晚班。
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（可重複執行）。
-- 這支先跑，接著依序重貼既有的四支（都改過）：
--   orders-rpc.sql（沒填手機不能送單）→ auto-cancel.sql（已繳未取件的自動取消只限大量設備）→
--   partial-extend.sql（延期改成學生申請、學會確認）→ admin-notifications.sql（延期申請通知學會）
-- 前置：schema、operator-access、members-v2、pending-staff。
-- 2026-11-14 第一次執行後又加了三樣，要再貼一次（照這個順序）：
--   equipment-bundles.sql（雷切機兩班都借押金一份改成內建，不用組合）→ 這支（第 4 節：刪掉先前建的雷切機組合；
--   第 5 節：後台通知點一則已讀；整支重跑沒關係）→ orders-rpc.sql（雷切機撞到休息的那一班不能送單）。其餘三支不用重貼。
-- =============================================================

-- ---------- 1. 訂單封存 ----------
-- 學期結束把已完成的單從後台訂單頁清掉：只是標記，資料不刪（單號流水靠當年度筆數算，刪了會撞號；學生自己的訂單頁也還看得到）。
-- 由最高權限在訂單頁按「清除已完成」寫入（RLS orders: admin all），訂單頁預設不列，工具列「已封存」可以回頭看。
alter table public.orders add column if not exists archived_at timestamptz;

-- ---------- 2. 學生自行取消 ----------
-- 只有還沒繳押金的單（on hold）：取消後佔用立刻釋放。已繳押金的牽涉退錢，照舊到學會由學會代取消。
-- 通知學會由 orders 的 trigger 發（admin-notifications.sql：本人把 status 改成 canceled）。
create or replace function public.cancel_my_order(p_rental_number text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '未登入';
  end if;

  update public.orders set status = 'canceled'
    where rental_number = p_rental_number and student_id = v_uid
      and status = 'pending' and deposit_paid_at is null;
  if not found then
    raise exception '只有還沒繳押金的訂單可以自己取消，已繳押金請到系學會辦理';
  end if;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_uid, 'info', '訂單已取消', '訂單 ' || p_rental_number || ' 已取消。', '/profile');
end;
$$;

-- ---------- 3. 學會成員唯讀看會員管理 ----------
-- 學會成員可以看會員管理（從訂單頁點姓名／學號過來查這個人），不能改：寫入仍只有 admin（RLS）。
-- students 的 RLS 照舊不開（operator-access.sql 開頭的理由），整頁要的資料用這支一次給：
-- 帳號、預先登記（未啟用）、系學會名單（姓名學號已帶好；學會成員讀不到 staff_members 內嵌的 students）。
create or replace function public.operator_members()
returns jsonb
language sql
security definer set search_path = public
stable
as $$
  select jsonb_build_object(
    'members', coalesce((select jsonb_agg(to_jsonb(s) order by s.student_id) from public.students s), '[]'::jsonb),
    'allowlist', coalesce((select jsonb_agg(to_jsonb(a) order by a.student_id) from public.login_allowlist a), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id,
        'position', m.position,
        'studentNo', coalesce(s.student_id, m.pending_sid),
        'name', coalesce(s.name, a.name, '')
      ) order by m.id)
      from public.staff_members m
      left join public.students s on s.id = m.student_id
      left join public.login_allowlist a on a.student_id = m.pending_sid
    ), '[]'::jsonb)
  )
  where public.backend_access() in ('admin', 'operator');
$$;

-- ---------- 4. 雷切機分午班／晚班 ----------
-- 學會（2026-11-14）：雷切機只能在營業時間用，借的時候選午班、晚班或兩班都借。
-- 做法：拆成兩個設備各 1 台，佔用各算各的（同一天午班、晚班可以不同人借），送單／撞期／延期的檢查都不用改；
-- 前台型錄把「XX（午班）」「XX（晚班）」併成一張卡片、多一個時段下拉（EquipmentGrid），清單與訂單裡直接寫午班／晚班。
-- 名稱都要留「雷切」：一年級上傳證明的規則靠名稱認（submit_orders）。之後改名、改押金、換圖都在後台設備管理做。
update public.equipment set name = '雷切機（午班）', en_name = 'Laser Cutter (Noon)'
  where id = '#MGSA001' and name = '雷切機';

insert into public.equipment
  (id, name, en_name, category, sub_category, location, original_quantity, stock_quantity, deposit, image_url, is_active)
select '#MGSA001-E', '雷切機（晚班）', 'Laser Cutter (Evening)', category, sub_category, location,
       original_quantity, stock_quantity, deposit, image_url, is_active
  from public.equipment where id = '#MGSA001'
on conflict (id) do nothing;

-- 兩班都借押金只收一份、算 1 件（Bernard 2026-11-14 定）：內建規則，不用建組合——
-- equipment-bundles.sql 的 equipment_bundle_calc（server）與前端 bundleUtils.shiftPairBundles。
-- 這支的第一版建過「雷切機（午班＋晚班）」組合，這裡刪掉（品項跟著 cascade）。
-- 只在新版 equipment_bundle_calc 已經貼過時才刪：還沒貼就刪的話，server 會照兩份押金收（前台卻顯示一份）
delete from public.equipment_bundles b
  where b.name = '雷切機（午班＋晚班）'
    and not exists (select 1 from public.equipment_bundle_items i
                    where i.bundle_id = b.id and i.equipment_id not in ('#MGSA001', '#MGSA001-E'))
    and exists (select 1 from pg_proc p
                where p.proname = 'equipment_bundle_calc' and p.pronamespace = 'public'::regnamespace
                  and p.prosrc like '%午班%');

-- ---------- 5. 後台通知：點一則＝那則已讀 ----------
-- 值班共用的收件匣（發給 admin 的通知），學會成員沒有那幾列的 RLS，所以走 RPC；
-- 同 operator-access.sql 的 operator_mark_notifications_read（那支是全部已讀），這支只標一則。
create or replace function public.operator_mark_notification_read(p_id bigint)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.operator_handler(null);
  update public.notifications n
    set is_read = true
    from public.students s
    where n.id = p_id and s.id = n.student_id and s.role = 'admin' and not n.is_read;
end;
$$;

notify pgrst, 'reload schema';
