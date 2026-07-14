-- SCCD Booking — 情境 6：逾期自動標記（order-lifecycle.md 定案 2026-07-14）
-- 規則：in-progress 過了「有效歸還期限」仍未歸還 → 自動改 overdue、發通知。
-- 有效歸還期限 = 歸還日（若撞週六日／臨時公休則順延到下一個營業日）的 19:00，
-- 超過即逾期（19:01 起算）——19:00 是系學會最後營業時間。
-- 罰款不在此計算：逾期中由前端即時試算顯示，歸還時最終金額由後台凍結寫入 penalty_total。
-- 前置：先執行 auto-cancel.sql（closed_dates 表、pg_cron）。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。

-- ---------- 1. 罰款凍結欄位 ----------
-- null = 尚未結算；歸還時由系學會確認金額後寫入（階段 2 後台，過渡期 Studio 手動）。
alter table public.orders add column if not exists penalty_total int;

-- ---------- 2. 有效歸還期限的日期 ----------
-- 從 p_day 起往後找第一個營業日（含 p_day 本身）；週六日與 closed_dates 順延。
-- ponytail: 最多往後找 30 天，連休超過 30 天不在系上現實範圍內
create or replace function public.next_business_day(p_day date)
returns date
language sql
stable
set search_path = public
as $$
  select g.d::date
  from generate_series(p_day, p_day + 30, interval '1 day') g(d)
  where extract(isodow from g.d) not in (6, 7)
    and not exists (select 1 from public.closed_dates c where c.day = g.d::date)
  order by 1
  limit 1
$$;

-- ---------- 3. 自動標記逾期 ----------
-- 過了有效期限 19:00（台北時間）仍是 in-progress → overdue，並發通知提醒罰款翻倍。
create or replace function public.mark_overdue()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update public.orders
       set status = 'overdue'
     where status = 'in-progress'
       and (now() at time zone 'Asia/Taipei')
           > public.next_business_day(end_date)::timestamp + interval '19 hours'
     returning rental_number, student_id
  )
  insert into public.notifications (student_id, type, title, message, link)
  select student_id, 'warning', '訂單已逾期',
         '訂單 ' || rental_number || ' 已逾期，請儘速歸還。逾期罰款自第 1 日 100 元起每日翻倍（上限為押金總額）。',
         '/profile'
  from expired;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------- 4. 排程 ----------
-- 每 5 分鐘掃一次，與 cancel-expired-pending 同頻（同名 schedule 重複執行會覆蓋）。
select cron.schedule('mark-overdue', '*/5 * * * *',
  $$select public.mark_overdue()$$);
