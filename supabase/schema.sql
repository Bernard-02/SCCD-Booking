-- =============================================================
-- SCCD Booking — Supabase 初始 schema
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上全部 → Run
-- 對應規劃：docs/supabase-backend-plan.md；規則：docs/rental-rules.md
-- =============================================================

-- ---------- 1. 學生（profile，本體是 auth.users） ----------
create table public.students (
  id uuid primary key references auth.users (id) on delete cascade,
  student_id text unique not null,          -- 學號（登入介面輸入用）
  name text not null default '',
  email text unique not null,
  grade text,                               -- 年級／學制（正式名單確定後可改 enum）
  role text not null default 'student' check (role in ('student', 'admin', 'staff')),
  account_level int not null default 0 check (account_level between 0 and 5), -- 帳號狀態 6 級
  overdue_days int not null default 0,      -- 累計逾期天數（滿 5 天停權）
  created_at timestamptz not null default now()
);

-- 註冊時自動建立 profile（student_id / name 從 signUp 的 metadata 帶入）
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.students (id, email, student_id, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'student_id', new.email),
    coalesce(new.raw_user_meta_data ->> 'name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 取得目前使用者角色（security definer 避免 RLS 遞迴）
create function public.user_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select role from public.students where id = auth.uid();
$$;

-- ---------- 2. 設備 ----------
create table public.equipment (
  id text primary key,                      -- '{分頁slug}-{名稱hash}'，由 seed 產生
  name text not null,
  en_name text,                             -- 英文名稱（前台暫不渲染，之後在 Table Editor 補）
  category text not null,                   -- 大類（Excel 分頁）：線材/工具/延長線/視聽類/燈具/畫板/展桌/展台/機具/搖頭燈
  sub_category text,                        -- 子類別（如「視源線 - HDMI」「推車」）
  location text,                            -- 存放地點（如「A503 - 設備區」）
  original_quantity int not null default 0 check (original_quantity >= 0), -- 總量
  stock_quantity int not null default 0,    -- 目前在庫（線下借出的差額由管理員手動維護）
  deposit int not null default 0,
  image_url text,                           -- 之後改 Supabase Storage URL
  is_active boolean not null default true,  -- 下架用，不實刪
  created_at timestamptz not null default now()
);

-- ---------- 3. 空間（編號區塊＋教室） ----------
create table public.space (
  id text primary key,                      -- 前端 SVG 的格子代號：'A1'…'L6'、'Z9'、'A503'
  venue_code text unique,                   -- 官方編號（Platform Venues）：'#A5NA001'、'#A5CA003'
  name text,                                -- 顯示名稱（教室用「A503 教室」，區塊同 id）
  area text not null,                       -- square / corridor(專案許可區) / front-terrace / back-terrace / glass-wall / pillar / classroom
  deposit int not null default 1000,        -- 後陽台 2000、教室 5000、其餘 1000
  is_active boolean not null default true
);

-- ---------- 4. 訂單 ----------
create table public.orders (
  id bigint generated always as identity primary key,
  rental_number text unique not null,       -- '#2026001'，流水號每年重置（產號邏輯在應用層）
  student_id uuid not null references public.students (id),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  booking_type text not null check (booking_type in ('little', 'mass-personal', 'mass-group')),
  status text not null default 'pending'
    check (status in ('pending', 'in-progress', 'overdue', 'returned', 'canceled')),
  deposit_total int not null default 0,     -- 已套用 5000 cap 的實收押金
  has_extended boolean not null default false,
  reason text,                              -- 借用資訊：使用原因
  class_name text,                          -- 大量／團體：使用班級
  teacher text,                             -- 大量／團體：負責老師
  created_at timestamptz not null default now()
);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  item_type text not null check (item_type in ('equipment', 'space-block', 'classroom')),
  item_id text not null,                    -- equipment.id 或 space_blocks.id
  name text not null,                       -- 冗餘存名稱，設備改名不影響歷史訂單
  quantity int not null default 1 check (quantity > 0),
  deposit int not null default 0            -- 單價（未 cap）
);

create index order_items_order_id_idx on public.order_items (order_id);
create index orders_student_id_idx on public.orders (student_id);
create index orders_dates_idx on public.orders (start_date, end_date);

-- ---------- 5. 通知 ----------
create table public.notifications (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.students (id) on delete cascade,
  type text not null default 'info',
  title text not null,
  message text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_student_id_idx on public.notifications (student_id);

-- =============================================================
-- RLS（真正的權限防線；前端 AdminRoute 只是 UX）
-- =============================================================
alter table public.students enable row level security;
alter table public.equipment enable row level security;
alter table public.space enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.notifications enable row level security;

-- students：本人可讀自己；admin 可讀改全部
create policy "students: read own" on public.students
  for select using (id = auth.uid());
create policy "students: admin read all" on public.students
  for select using (public.user_role() = 'admin');
create policy "students: admin update" on public.students
  for update using (public.user_role() = 'admin');

-- equipment / space_blocks：目錄公開可讀（未登入也能逛型錄）；只有 admin 可改
create policy "equipment: public read" on public.equipment
  for select using (true);
create policy "equipment: admin write" on public.equipment
  for all using (public.user_role() = 'admin');
create policy "space: public read" on public.space
  for select using (true);
create policy "space: admin write" on public.space
  for all using (public.user_role() = 'admin');

-- orders：本人建立／讀取自己的；admin 全權；staff 建單免審核（狀態直接 in-progress 由應用層帶）
create policy "orders: insert own" on public.orders
  for insert with check (student_id = auth.uid());
create policy "orders: read own" on public.orders
  for select using (student_id = auth.uid());
create policy "orders: admin all" on public.orders
  for all using (public.user_role() = 'admin');

-- order_items：跟隨所屬訂單的權限
create policy "order_items: insert via own order" on public.order_items
  for insert with check (
    exists (select 1 from public.orders o where o.id = order_id and o.student_id = auth.uid())
  );
create policy "order_items: read via own order" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.student_id = auth.uid())
  );
create policy "order_items: admin all" on public.order_items
  for all using (public.user_role() = 'admin');

-- notifications：本人讀＋標記已讀；admin 可發
create policy "notifications: read own" on public.notifications
  for select using (student_id = auth.uid());
create policy "notifications: update own" on public.notifications
  for update using (student_id = auth.uid());
create policy "notifications: admin insert" on public.notifications
  for insert with check (public.user_role() = 'admin');
