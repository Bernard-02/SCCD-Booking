-- SCCD Booking — Auth 接線設定
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。
-- 另需在 Dashboard → Authentication → Sign In / Up → Email 關閉「Confirm email」
--（開發期免驗證信；正式名單匯入後再評估開回來）。

-- students 補 profile 欄位（前端 Profile 頁顯示用）
alter table public.students add column if not exists phone text;
alter table public.students add column if not exists class_name text;

-- 註冊 trigger 更新：從 signUp metadata 帶入完整 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.students (id, email, student_id, name, grade, class_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'student_id', new.email),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'grade',
    new.raw_user_meta_data ->> 'class_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

-- 學號 → email（登入前的查詢；security definer 繞過 RLS，但只回傳 email 一個欄位）
create or replace function public.email_for_student(sid text)
returns text
language sql
security definer set search_path = public
stable
as $$
  select email from public.students where student_id = sid;
$$;

-- 更新自己的手機號碼（students 的 update RLS 只開放 admin，
-- 一般使用者透過此函式只能改本人的 phone 一個欄位，避免自改 role/grade）
create or replace function public.update_my_phone(p_phone text)
returns void
language sql
security definer set search_path = public
as $$
  update public.students set phone = p_phone where id = auth.uid();
$$;
