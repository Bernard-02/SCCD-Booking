-- =============================================================
-- 值班表可以先排還沒啟用的系學會（2026-11-09）
-- 帳號要本人第一次登入才會建立，但值班表在開放租借前就要排好：staff_members 可以先用學號佔位（pending_sid），
-- 帳號建立時自動接上，排好的值班跟著走。後台權限看 student_id，佔位的人進不了後台（operator-access.sql）。
-- 佔位列跟著預先登記走：標成系學會就有、改掉身份或刪除登記就沒了（值班一起刪）。
-- 使用方式：SQL Editor 貼上執行（可重複執行）。前置：staff-members、members-v2。
-- =============================================================

alter table public.staff_members alter column student_id drop not null;
alter table public.staff_members add column if not exists pending_sid text unique references public.login_allowlist (student_id) on delete cascade;
alter table public.staff_members drop constraint if exists staff_members_owner_check;
alter table public.staff_members add constraint staff_members_owner_check check (student_id is not null or pending_sid is not null);

create or replace function public.sync_pending_staff()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not new.is_sa then
    delete from public.staff_members where pending_sid = new.student_id;
  elsif not exists (select 1 from public.students s where s.student_id = new.student_id) then
    insert into public.staff_members (pending_sid, position) values (new.student_id, coalesce(new.position, ''))
    on conflict (pending_sid) do update set position = excluded.position;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_pending_staff on public.login_allowlist;
create trigger sync_pending_staff
  after insert or update on public.login_allowlist
  for each row execute function public.sync_pending_staff();

-- 帳號建立時接上佔位列（Google 或密碼帳號都走這裡）
create or replace function public.link_pending_staff()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.staff_members set student_id = new.id, pending_sid = null
    where pending_sid = upper(new.student_id);
  return new;
end;
$$;

drop trigger if exists link_pending_staff on public.students;
create trigger link_pending_staff
  after insert on public.students
  for each row execute function public.link_pending_staff();

-- 已經登記好、還沒帳號的系學會補佔位列
insert into public.staff_members (pending_sid, position)
select a.student_id, coalesce(a.position, '')
from public.login_allowlist a
where a.is_sa and not exists (select 1 from public.students s where s.student_id = a.student_id)
on conflict (pending_sid) do nothing;

notify pgrst, 'reload schema';
