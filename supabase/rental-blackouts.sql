-- SCCD Booking — 情境 11-a：寒暑假封鎖（order-lifecycle.md 定案 2026-07-14）
-- 規則：寒假／暑假一律不開放「學生（student）」租借；admin／staff（系辦超級帳號、學會特殊帳號）不受限。
-- 與 closed_dates 分開：公休日只暫停倒數，封鎖是直接擋新單。
-- 具體起訖日由 admin 維護（過渡期在 Studio 手動加列）。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）；實際擋單邏輯在 orders-rpc.sql 的 submit_orders。

create table if not exists public.rental_blackouts (
  id bigint generated always as identity primary key,
  start_date date not null,
  end_date date not null,
  reason text,
  check (end_date >= start_date)
);

alter table public.rental_blackouts enable row level security;

drop policy if exists "rental_blackouts: public read" on public.rental_blackouts;
create policy "rental_blackouts: public read" on public.rental_blackouts
  for select using (true);

drop policy if exists "rental_blackouts: admin write" on public.rental_blackouts;
create policy "rental_blackouts: admin write" on public.rental_blackouts
  for all using (public.user_role() = 'admin');

-- 範例（暑假）：insert into public.rental_blackouts (start_date, end_date, reason)
--   values ('2026-06-20', '2026-09-01', '暑假');
