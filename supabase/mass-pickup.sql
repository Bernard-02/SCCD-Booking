-- SCCD Booking — 大量設備：預選繳押金／取件時段（rental-rules 新規則 3，2026-10-02 定案）
-- 學會允許「先繳押金、之後取件」或兩者同時進行：
--   - 學生在購物車填借用資訊時選兩個時段（日期＋系學會值班時段）：
--     繳押金＝送單後 24 工作時內（自動取消規則不變），取件＝起租日當天。
--   - 後台收押金時可選「同時取件」→ in-progress；或只收押金 → 仍為 pending（deposit_paid_at 有值＝已繳待取件），
--     之後再按「取件」→ in-progress。
--   - 已繳押金但逾時未取件：後台提醒，由學會手動處理（聯絡或代取消＋退押金），不自動轉狀態。
-- 「已繳待取件」不新增 status 值：仍是 pending（佔用規則不變），以 deposit_paid_at 區分。
-- 使用方式：SQL Editor 執行本檔（可重複執行），接著重貼 orders-rpc.sql、auto-cancel.sql、admin-actions.sql。

alter table public.orders add column if not exists deposit_date date;          -- 預計繳押金日
alter table public.orders add column if not exists deposit_slot text;          -- 預計繳押金時段 'HH:MM-HH:MM'
alter table public.orders add column if not exists pickup_slot text;           -- 預計取件時段（日期＝起租日）
alter table public.orders add column if not exists deposit_paid_at timestamptz; -- 實際收押金時間（取件前也可先收）
alter table public.orders add column if not exists picked_up_by text;          -- 取件經手（姓名快照）

-- 值班時段（給學生選時段用）：只回傳星期與時間，不含幹部個資；staff_duties 本身只有 admin 讀得到
create or replace function public.duty_slots()
returns table(weekday smallint, start_time time, end_time time)
language sql
security definer set search_path = public
stable
as $$
  select distinct d.weekday, d.start_time, d.end_time
  from public.staff_duties d
  order by 1, 2, 3
$$;
