-- =============================================================
-- 後台通知（2026-11-02）：學生（或助教直借）自己對訂單做的動作，發一則通知給 admin 帳號（sccdsa）。
-- 後台側欄鈴鐺顯示，點一則跳到 /admin/orders?student=學號（該生的訂單）。
--
-- 用 orders 表的 trigger 做，不必動各支 RPC。「本人自己做的」＝ auth.uid() = 該單 student_id：
-- 後台代操作是 admin 的 uid、pg_cron 排程沒有 uid，都不會發。
-- 事件：送單（新訂單）、修改品項（items_updated_at 變動）、延期申請（extend_request 有新的，2026-11-14；欄位在 partial-extend.sql，那支要先跑）、
--       自行取消（status → canceled，cancel_my_order）。
--       整單延期／部分延期拆子單那兩段是 2026-11-14 前學生延期直接生效時用的，現在延期由學會按通過，只有學會成員通過自己的單才會走到。
-- 在 Supabase SQL Editor 執行（可重複執行）。
-- =============================================================

create or replace function public.notify_admins(p_type text, p_title text, p_message text, p_link text)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.notifications (student_id, type, title, message, link)
  select id, p_type, p_title, p_message, p_link from public.students where role = 'admin';
$$;

create or replace function public.orders_notify_admins()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_who text;
  v_link text;
begin
  if auth.uid() is null or auth.uid() <> new.student_id then
    return new;
  end if;

  select name || '（' || student_id || '）', '/admin/orders?student=' || student_id
    into v_who, v_link
    from public.students where id = new.student_id;

  if tg_op = 'INSERT' then
    if new.parent_order_id is null then
      perform public.notify_admins('info', '新訂單',
        v_who || ' 送出訂單 ' || new.rental_number || '。', v_link);
    else
      perform public.notify_admins('info', '部分延期',
        v_who || ' 部分延期，拆出子單 ' || new.rental_number || '，新歸還日 ' || to_char(new.end_date, 'YYYY-MM-DD') || '。', v_link);
    end if;
  elsif new.items_updated_at is distinct from old.items_updated_at then
    perform public.notify_admins('info', '修改訂單',
      v_who || ' 修改了訂單 ' || new.rental_number || ' 的品項。', v_link);
  elsif new.extend_request is not null and new.extend_request is distinct from old.extend_request then
    perform public.notify_admins('info', '延期申請',
      v_who || ' 申請將訂單 ' || new.rental_number || ' 延期 ' || (new.extend_request ->> 'days') || ' 天'
      || case when (new.extend_request ->> 'all')::boolean then '' else '（部分品項）' end || '，等學會確認。', v_link);
  elsif new.has_extended and not old.has_extended and new.end_date <> old.end_date then
    perform public.notify_admins('info', '延期',
      v_who || ' 將訂單 ' || new.rental_number || ' 延期至 ' || to_char(new.end_date, 'YYYY-MM-DD') || '。', v_link);
  elsif new.status = 'canceled' and old.status <> 'canceled' then
    perform public.notify_admins('warning', '取消訂單',
      v_who || ' 取消了訂單 ' || new.rental_number || '。', v_link);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_notify_admins on public.orders;
create trigger orders_notify_admins
  after insert or update on public.orders
  for each row execute function public.orders_notify_admins();
