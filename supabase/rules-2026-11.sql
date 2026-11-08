-- =============================================================
-- 2026-11-07 學會決議落地（docs/sa-discussion.md）：欄位、證明檔 bucket、F 區、新 RPC。
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（可重複執行）。
-- 這支要先跑，接著依序重貼既有函式（都改過）：
--   orders-rpc.sql → auto-cancel.sql → auto-overdue.sql → account-suspension.sql → admin-actions.sql →
--   modify-order.sql → partial-extend.sql → members-v2.sql → penalty-and-grades.sql
-- =============================================================

-- ---------- 1. 訂單欄位 ----------
-- 取件日：null＝起租日。公休撞到取件時段才能改（change_my_pickup），只有大量設備有
alter table public.orders add column if not exists pickup_date date;
-- 老師名義：押金歸零、老師名稱存 orders.teacher；proof_path＝bucket proofs 裡的路徑（雷切機一年級的核可證明也放這，as_teacher＝false）
alter table public.orders add column if not exists as_teacher boolean not null default false;
alter table public.orders add column if not exists proof_path text;
-- 退押金經手（姓名快照）；退多少沿用 orders.refunded（partial-extend.sql 建的）
alter table public.orders add column if not exists refunded_by text;

-- ---------- 2. 公休時段 ----------
-- all＝整天（同週末：倒數、逾期都跳過）；noon／evening＝只休那一班，當天仍算營業日。
-- evening 公休那天沒有 19:00 的收件，歸還期限要順延（auto-overdue.sql next_business_day）
alter table public.closed_dates add column if not exists shift text not null default 'all';
alter table public.closed_dates drop constraint if exists closed_dates_shift_check;
alter table public.closed_dates add constraint closed_dates_shift_check check (shift in ('all', 'noon', 'evening'));

-- ---------- 3. 系學會費與名單班級 ----------
-- 已存在的帳號都是測試帳號，建欄位當下視為已繳（不然全部送不了單）；之後新帳號預設未繳，由名單帶入
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'students' and column_name = 'dues_paid') then
    alter table public.students add column dues_paid boolean not null default true;
    alter table public.students alter column dues_paid set default false;
  end if;
end $$;
alter table public.login_allowlist add column if not exists grade text;      -- 匯入的班級拆成 grade＋class_name，同 students
alter table public.login_allowlist add column if not exists class_name text;
alter table public.login_allowlist add column if not exists dues_paid boolean not null default false;

-- ---------- 4. 證明文件（私有 bucket，只有本人與 admin 讀得到）----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 10485760, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "proofs: own upload" on storage.objects;
create policy "proofs: own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "proofs: own or admin read" on storage.objects;
create policy "proofs: own or admin read" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.user_role() = 'admin'));

-- ---------- 5. F 區（E1–E6 靠走廊的長條獨立出來，中庭的 E1–E6 不動；編號同 Venues 表）----------
insert into public.space (id, venue_code, name, area, deposit, is_active)
select 'F' || n, '#A5NF00' || n, 'F' || n, 'area-f', 1000, true
from generate_series(1, 6) n
on conflict (id) do nothing;

-- ---------- 6. 公休改取件日 ----------
-- 時段是否公休：slot＝'HH:MM-HH:MM'，15:00 前算午班（同前台 shiftOfSlot）
create or replace function public.slot_closed(p_day date, p_slot text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.closed_dates c
    where c.day = p_day
      and (c.shift = 'all' or c.shift = case when left(p_slot, 5) < '15:00' then 'noon' else 'evening' end)
  )
$$;

-- 學生改取件：只有目前的取件時段碰到公休才能改，新時段最晚到起租日、起租／歸還日不動（學會決議 2026-11-06）。
-- 還沒繳押金的繳押金時段若晚於新取件，跟著提前（取件不得早於繳押金）。改完通知學會。
create or replace function public.change_my_pickup(p_rental_number text, p_date date, p_slot text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders%rowtype;
begin
  if v_uid is null then
    raise exception '未登入';
  end if;
  select * into v_order from public.orders
    where rental_number = p_rental_number and student_id = v_uid
    for update;
  if not found then
    raise exception '查無此訂單';
  end if;
  if v_order.status <> 'pending' or v_order.pickup_slot is null then
    raise exception '僅待取件的大量設備訂單可改取件日';
  end if;
  if not public.slot_closed(coalesce(v_order.pickup_date, v_order.start_date), v_order.pickup_slot) then
    raise exception '目前的取件時段沒有公休，不用改取件日';
  end if;
  if p_date < (now() at time zone 'Asia/Taipei')::date or p_date > v_order.start_date then
    raise exception '取件日需介於今天與起租日之間';
  end if;
  if public.slot_closed(p_date, p_slot) or not exists (
    select 1 from public.staff_duties d
    where d.weekday = extract(dow from p_date)
      and to_char(d.start_time, 'HH24:MI') || '-' || to_char(d.end_time, 'HH24:MI') = p_slot
  ) then
    raise exception '這個時段沒有值班，請重新選擇';
  end if;

  update public.orders
    set pickup_date = p_date,
        pickup_slot = p_slot,
        deposit_date = case when deposit_paid_at is null and deposit_date > p_date then p_date else deposit_date end,
        deposit_slot = case when deposit_paid_at is null and deposit_date > p_date then p_slot else deposit_slot end
    where id = v_order.id;

  perform public.notify_admins('info', '改取件日',
    (select name || '（' || student_id || '）' from public.students where id = v_uid) ||
    ' 將訂單 ' || p_rental_number || ' 改到 ' || to_char(p_date, 'MM/DD') || ' ' || p_slot || ' 取件。',
    '/admin/orders?student=' || (select student_id from public.students where id = v_uid));
end;
$$;

-- ---------- 7. 後台退押金 ----------
-- 已繳押金但取消的單（含沒來取件自動取消），以及大量單拆單全還後人工結的押金
create or replace function public.admin_refund_deposit(p_rental_number text, p_handler text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_student uuid;
  v_amount int;
begin
  if public.user_role() <> 'admin' then
    raise exception '僅限管理員';
  end if;

  update public.orders
    set refunded = deposit_total, refunded_by = p_handler
    where rental_number = p_rental_number
      and status in ('canceled', 'returned')
      and deposit_paid_at is not null
      and deposit_total > 0
      and refunded is null
    returning student_id, deposit_total into v_student, v_amount;
  if not found then
    raise exception '此訂單沒有待退的押金';
  end if;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_student, 'success', '押金已退還',
          '訂單 ' || p_rental_number || ' 的押金 NT$ ' || v_amount || ' 已退還。', '/profile');
end;
$$;

notify pgrst, 'reload schema';
