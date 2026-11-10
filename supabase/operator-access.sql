-- =============================================================
-- 後台分權（2026-11-08 Bernard 定）：最高權限＝admin（sccdsa），學會成員用自己的帳號，只能用「值班」（訂單、A5F 編號區、通知）；「設定」維持 user_role() = 'admin'。
-- 學會成員＝會員管理標成「系學會」的人（staff_members），students.role 仍是 student，借東西的規則照舊。
-- 不開 orders／students 的 RLS：開了的話學會成員自己的訂單頁（fetchMyOrders 靠 RLS 篩）會撈到所有人的單，手機、Email 也讀得到。
-- 值班頁讀資料走這裡的 RPC，寫入走各支值班 admin_* RPC（開頭呼叫 operator_handler）。
-- 學會成員的後台權限登入滿 12 小時失效（同 admin，admin-session-limit.sql），要重新登入；學生身份不受影響。
-- 使用方式：SQL Editor 貼上執行（可重複執行）。前置：schema、staff-members、admin-notifications、rules-2026-11、admin-session-limit。
-- =============================================================

-- admin＝最高權限；operator＝學會成員；expired＝學會成員但這次登入滿 12 小時；none＝沒有後台權限
create or replace function public.backend_access()
returns text
language sql
security definer set search_path = public
stable
as $$
  select case
    when public.user_role() = 'admin' then 'admin'
    when not exists (
      select 1 from public.staff_members m
      join public.students s on s.id = m.student_id
      where m.student_id = auth.uid() and not s.graduated
    ) then 'none'
    when exists (
      select 1 from auth.sessions a
      where a.id = (auth.jwt() ->> 'session_id')::uuid
        and a.created_at > now() - interval '12 hours'
    ) then 'operator'
    else 'expired'
  end;
$$;

-- 值班 RPC 的權限關卡，回傳要記的經手人：學會成員一律記登入的本人，admin（共用帳號）用傳進來的
create or replace function public.operator_handler(p_handler text)
returns text
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_access text := public.backend_access();
begin
  if v_access = 'admin' then
    return p_handler;
  end if;
  if v_access <> 'operator' then
    raise exception '僅限管理員';
  end if;
  return (select name from public.students where id = auth.uid());
end;
$$;

-- 訂單頁：同 orders 加品項，借用人只給姓名學號
create or replace function public.operator_orders()
returns setof jsonb
language sql
security definer set search_path = public
stable
as $$
  select to_jsonb(o) || jsonb_build_object(
    'order_items', coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.order_items i where i.order_id = o.id), '[]'::jsonb),
    'students', (select jsonb_build_object('student_id', s.student_id, 'name', s.name) from public.students s where s.id = o.student_id)
  )
  from public.orders o
  where (select public.backend_access()) in ('admin', 'operator')
  order by o.created_at desc, o.id desc;
$$;

-- A5F 編號區：指定日期佔用中的空間與借用人
create or replace function public.operator_space_occupancy(p_date date)
returns table (item_id text, item_type text, rental_number text, status text, start_date date, end_date date, student_name text, student_no text)
language sql
security definer set search_path = public
stable
as $$
  select i.item_id, i.item_type, o.rental_number, o.status, o.start_date, o.end_date, s.name, s.student_id
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.students s on s.id = o.student_id
  where (select public.backend_access()) in ('admin', 'operator')
    and i.item_type in ('space-block', 'classroom')
    and o.status in ('pending', 'in-progress', 'overdue')
    and o.start_date <= p_date
    and o.end_date >= p_date;
$$;

-- 代改借用資訊（原因／班級／老師／預選時段）：沒帶的欄位不動
create or replace function public.operator_update_order_info(p_rental_number text, p_info jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.operator_handler(null);
  update public.orders
    set reason = case when p_info ? 'reason' then p_info ->> 'reason' else reason end,
        class_name = case when p_info ? 'class_name' then p_info ->> 'class_name' else class_name end,
        teacher = case when p_info ? 'teacher' then p_info ->> 'teacher' else teacher end,
        deposit_date = case when p_info ? 'deposit_date' then (p_info ->> 'deposit_date')::date else deposit_date end,
        deposit_slot = case when p_info ? 'deposit_slot' then p_info ->> 'deposit_slot' else deposit_slot end,
        pickup_slot = case when p_info ? 'pickup_slot' then p_info ->> 'pickup_slot' else pickup_slot end
    where rental_number = p_rental_number;
  if not found then
    raise exception '訂單不存在';
  end if;
end;
$$;

-- 通知頁＝值班共用收件匣：發給 admin 的通知（notify_admins），誰按全部已讀大家都已讀。學會成員自己的鈴鐺不受影響
create or replace function public.operator_notifications()
returns setof public.notifications
language sql
security definer set search_path = public
stable
as $$
  select n.*
  from public.notifications n
  join public.students s on s.id = n.student_id and s.role = 'admin'
  where (select public.backend_access()) in ('admin', 'operator')
    and n.created_at > now() - interval '7 days'
  order by n.created_at desc;
$$;

create or replace function public.operator_mark_notifications_read()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.operator_handler(null);
  update public.notifications n
    set is_read = true
    from public.students s
    where s.id = n.student_id and s.role = 'admin' and not n.is_read;
end;
$$;

-- 收押金時要看老師名義的證明檔（多一條 policy，跟 rules-2026-11.sql 那條是「或」的關係）
drop policy if exists "proofs: operator read" on storage.objects;
create policy "proofs: operator read" on storage.objects for select to authenticated
  using (bucket_id = 'proofs' and public.backend_access() = 'operator');

notify pgrst, 'reload schema';
