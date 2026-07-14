-- SCCD Booking — 情境 7：逾期滿 6 營業日自動停權（order-lifecycle.md 定案 2026-07-14）
-- 官方規則（Google 文件）：單筆訂單逾期達 6 日（不含假日）＝未完成清潔歸還
-- → 不可再使用預約系統。停權為 sticky：歸還後仍鎖，由系學會人工解鎖
-- （過渡期在 Studio 把 students.account_level 改回 0）。
-- 帳號第 1-6 級標籤為前端即時計算（看當前最嚴重逾期單），不入庫；只有停權寫 account_level = 5。
-- 前置：先執行 auto-cancel.sql 與 auto-overdue.sql。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。

-- ---------- 1. 逾期營業日天數 ----------
-- 從有效歸還期限（next_business_day(end_date)）的隔日起算到今天，週六日與臨時公休不計。
-- 前端 timeUtils.overdueBusinessDays 為同邏輯的顯示用版本。
create or replace function public.overdue_business_days(p_end date)
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::int
  from generate_series(
         public.next_business_day(p_end) + 1,
         (now() at time zone 'Asia/Taipei')::date,
         interval '1 day'
       ) g(d)
  where extract(isodow from g.d) not in (6, 7)
    and not exists (select 1 from public.closed_dates c where c.day = g.d::date)
$$;

-- ---------- 2. 自動停權 ----------
-- 任一張 overdue 單逾期滿 6 個營業日 → account_level = 5，發停權通知。回傳停權人數。
create or replace function public.suspend_overdue_accounts()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  with suspended as (
    update public.students s
       set account_level = 5
     where s.account_level < 5
       and exists (
         select 1 from public.orders o
         where o.student_id = s.id
           and o.status = 'overdue'
           and public.overdue_business_days(o.end_date) >= 6
       )
     returning s.id
  )
  insert into public.notifications (student_id, type, title, message, link)
  select id, 'error', '帳號已停權',
         '您有訂單逾期已滿 6 個營業日，視為未完成清潔歸還，帳號已停權、無法再送出預約。請儘速聯絡系學會處理歸還與罰款事宜。',
         '/profile'
  from suspended;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------- 3. 排程 ----------
-- 每小時掃一次即可（天數以「日」為單位變化，不需要 5 分鐘一次）。
select cron.schedule('suspend-overdue-accounts', '0 * * * *',
  $$select public.suspend_overdue_accounts()$$);
