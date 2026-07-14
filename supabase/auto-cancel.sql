-- SCCD Booking — 情境 1：逾時未繳押金自動取消（order-lifecycle.md 定案 2026-07-14）
-- 規則：pending 訂單超過「24 工作時」未繳押金 → 自動改 canceled、釋放佔用、發通知。
-- 工作時 = 排除週六日與 closed_dates 的臨時公休日（整天不倒數）。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。

-- ---------- 1. 臨時公休日 ----------
-- 週六日內建排除，不用列；系學會辦活動等臨時不營業才加一列（過渡期在 Studio 手動加）。
create table if not exists public.closed_dates (
  day date primary key,
  reason text
);

alter table public.closed_dates enable row level security;

drop policy if exists "closed_dates: public read" on public.closed_dates;
create policy "closed_dates: public read" on public.closed_dates
  for select using (true);

drop policy if exists "closed_dates: admin write" on public.closed_dates;
create policy "closed_dates: admin write" on public.closed_dates
  for all using (public.user_role() = 'admin');

-- ---------- 2. 工作時計算 ----------
-- 從 p_from 到現在經過的「有效小時數」：總時長扣掉公休日（週六日＋closed_dates）
-- 與區間重疊的部分。以台北時區判定「哪一天」。前端 timeUtils.ts 有同邏輯的顯示用版本。
create or replace function public.business_hours_since(p_from timestamptz)
returns numeric
language sql
stable
set search_path = public
as $$
  with bounds as (
    select (p_from at time zone 'Asia/Taipei') as t0,
           (now() at time zone 'Asia/Taipei') as t1
  ),
  off_days as (
    select g.d::date as day
    from bounds, generate_series(bounds.t0::date, bounds.t1::date, interval '1 day') g(d)
    where extract(isodow from g.d) in (6, 7)
       or exists (select 1 from public.closed_dates c where c.day = g.d::date)
  ),
  off_secs as (
    select coalesce(sum(extract(epoch from
             least((o.day + 1)::timestamp, b.t1)
           - greatest(o.day::timestamp, b.t0))), 0) as secs
    from off_days o, bounds b
    where o.day::timestamp < b.t1
      and (o.day + 1)::timestamp > b.t0
  )
  select (extract(epoch from (b.t1 - b.t0)) - (select secs from off_secs)) / 3600.0
  from bounds b
$$;

-- ---------- 3. 自動取消 ----------
-- 把逾時的 pending 改成 canceled（佔用查詢只認 pending/in-progress/overdue，
-- 改完即釋放庫存與空間），並發「訂單已取消」通知。回傳取消筆數。
create or replace function public.cancel_expired_pending()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.orders
       set status = 'canceled'
     where status = 'pending'
       and public.business_hours_since(created_at) > 24
     returning rental_number, student_id
  )
  insert into public.notifications (student_id, type, title, message, link)
  select student_id, 'warning', '訂單已取消',
         '訂單 ' || rental_number || ' 因逾時未繳交押金已自動取消，如仍需租借請重新下單。',
         '/profile'
  from expired;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------- 4. 排程 ----------
-- pg_cron 每 5 分鐘掃一次（同名 schedule 重複執行會直接覆蓋，可重複跑）。
-- 前端對 pending 有同邏輯的即時顯示判定，掃描間隔內的空窗不影響使用者看到的狀態。
create extension if not exists pg_cron;
select cron.schedule('cancel-expired-pending', '*/5 * * * *',
  $$select public.cancel_expired_pending()$$);
