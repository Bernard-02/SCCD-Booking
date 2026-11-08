-- =============================================================
-- 2026-11-07 後台刪除帳號：key 錯或測試用的帳號，會員管理「修改」對話框可刪
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（可重複執行）
--
-- 只能刪沒有訂單的帳號（訂單要留紀錄）、不能刪管理員。
-- login_allowlist 的登記一起刪，否則本人還能再用 Google 登入建回帳號。
-- 刪 auth.users 會連帶刪 students、notifications、staff_members、identities、sessions。
-- =============================================================

create or replace function public.admin_delete_member(p_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_student public.students%rowtype;
begin
  if public.user_role() <> 'admin' then
    raise exception '僅限管理員';
  end if;

  select * into v_student from public.students where id = p_id;
  if v_student.id is null then
    raise exception '查無此帳號';
  end if;
  if v_student.role = 'admin' then
    raise exception '管理員帳號不能刪除';
  end if;
  if exists (select 1 from public.orders where student_id = p_id) then
    raise exception '此帳號有訂單紀錄，不能刪除';
  end if;

  delete from public.login_allowlist where upper(student_id) = upper(v_student.student_id);
  delete from auth.users where id = p_id;
end;
$$;

revoke execute on function public.admin_delete_member(uuid) from public, anon;
grant execute on function public.admin_delete_member(uuid) to authenticated;
