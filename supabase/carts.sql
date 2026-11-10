-- SCCD Booking — 購物車跟帳號走（2026-11-10）
-- 購物車與各單借用資訊存帳號，一人一列：手機加的換電腦也看得到。前端 src/services/cartService.ts。
-- 瀏覽器 localStorage 仍是本機那份，這裡是帳號那份，兩邊以較新的為準（updated_at）。
-- 表沒建時前端照舊只存本機。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。

create table if not exists public.carts (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  items jsonb not null default '[]',    -- CartItem[]（types/equipment.ts）
  details jsonb not null default '{}',  -- 各單借用資訊：cartGroupKey → BookingDetailsData
  updated_at timestamptz not null default now(),
  -- 正常一台購物車幾 KB；擋有人拿來塞大量資料
  constraint carts_size check (octet_length(items::text) + octet_length(details::text) < 200000)
);

alter table public.carts enable row level security;

-- 只能讀寫自己的那列（後台也不需要看別人的購物車）
drop policy if exists "carts: own" on public.carts;
create policy "carts: own" on public.carts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
