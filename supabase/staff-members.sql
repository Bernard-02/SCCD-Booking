-- SCCD Booking — 系學會幹部名單（值班經手人追溯）v2
-- 幹部連結 students 表（搜學號新增），附職位與值班時段；
-- 值班時段供經手人選單排序（當下值班的排最前，其餘照列，代班仍可選）。
-- 訂單上的 paid_by / returned_by 存「姓名快照」，名單異動或刪除都不影響歷史紀錄。
-- 使用方式：SQL Editor 執行本檔（會重建 staff_members，v1 的純姓名資料不保留——重新搜學號加入即可）。

drop table if exists public.staff_duties;
drop table if exists public.staff_members;

create table public.staff_members (
  id bigint generated always as identity primary key,
  student_id uuid not null unique references public.students (id) on delete cascade,
  position text not null default '',      -- 職位（會長、副會長…自由文字，每屆職稱可能不同）
  created_at timestamptz not null default now()
);

-- 值班時段：一人可多時段、同時段可多人（人力多寡不拘）
create table public.staff_duties (
  id bigint generated always as identity primary key,
  staff_id bigint not null references public.staff_members (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),  -- 0=週日…6=週六（同 JS getDay）
  start_time time not null,
  end_time time not null check (end_time > start_time)
);

alter table public.staff_members enable row level security;
alter table public.staff_duties enable row level security;

create policy "staff_members: admin all" on public.staff_members
  for all using (public.user_role() = 'admin');
create policy "staff_duties: admin all" on public.staff_duties
  for all using (public.user_role() = 'admin');

-- 訂單經手人（姓名快照）
alter table public.orders add column if not exists paid_by text;      -- 收押金經手
alter table public.orders add column if not exists returned_by text;  -- 歸還經手
