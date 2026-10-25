-- =============================================================
-- 2026-10-25 後台會員管理改版：預先登記會員（login_allowlist）＋封閉名單登入
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（一次性，可重複執行；不必先跑 google-login.sql，這裡自己建表）
--
-- students.id 綁 auth.users，帳號要本人第一次用 Google 登入才會建立。後台「新增會員」因此是「預先登記」：
-- 寫進 login_allowlist（學號、姓名、Email、身份），會員頁顯示為「未啟用」；本人第一次登入時 trigger 讀這一列，
-- 用登記的姓名／身份建帳號（系學會＝順便寫進 staff_members），之後這列就不再用（保留不刪，當紀錄）。
-- **封閉名單（2026-10-25 Bernard 定）：只有登記過的學號／Email 才能登入**，學號符合規則也不再自動放行
-- （原 google-login.sql 的自動放行取消）。上線前要先把全系名單匯入（後台「匯入」）。
-- =============================================================

-- 表（google-login.sql 也建；這裡重複一次讓本檔可單獨執行）
create table if not exists public.login_allowlist (
  student_id text primary key,              -- 大寫，例：A111144001
  note text,
  created_at timestamptz not null default now()
);
alter table public.login_allowlist enable row level security;
drop policy if exists "login_allowlist: admin all" on public.login_allowlist;
create policy "login_allowlist: admin all" on public.login_allowlist for all using (public.user_role() = 'admin');

alter table public.login_allowlist add column if not exists name text;
alter table public.login_allowlist add column if not exists email text;
alter table public.login_allowlist add column if not exists role text not null default 'student';
alter table public.login_allowlist add column if not exists is_transfer boolean not null default false;
alter table public.login_allowlist add column if not exists is_sa boolean not null default false;
alter table public.login_allowlist add column if not exists position text;
alter table public.login_allowlist drop constraint if exists login_allowlist_role_check;
alter table public.login_allowlist add constraint login_allowlist_role_check check (role in ('student', 'staff', 'admin'));

-- ---------- 註冊 trigger：Google 帳號只收登記過的，套用登記的姓名／身份；年級仍由學號推 ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_sid text;
  v_ay int; -- 目前學年度（民國）；9/1 換學年，同 promote-grades-yearly 排程（UTC 9/1 00:00）
  v_n int;  -- 第幾年
  v_pre public.login_allowlist%rowtype; -- 預先登記（沒有就全 null）
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google' then
    -- 密碼帳號：原本 signUp metadata 流程（auth-setup.sql）
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
  end if;

  if lower(new.email) !~ '^[a-z0-9]+@gm[12]?\.usc\.edu\.tw$' then
    raise exception '請使用學校 Google 帳號登入';
  end if;
  v_sid := upper(split_part(new.email, '@', 1));
  -- 登記：先對學號，沒有再對 Email（後台填的 Email 和學號推的不同時）；沒登記＝不能登入（封閉名單）
  select * into v_pre from public.login_allowlist where student_id = v_sid;
  if v_pre.student_id is null then
    select * into v_pre from public.login_allowlist where lower(email) = lower(new.email) limit 1;
  end if;
  if v_pre.student_id is null then
    raise exception '此帳號尚未登記，請聯繫系學會';
  end if;

  v_ay := extract(year from now() at time zone 'UTC')::int - 1911
          - case when extract(month from now() at time zone 'UTC') < 9 then 1 else 0 end;
  -- 只有符合規則的學號才推年級（例外名單的學號格式不一，substr 轉數字會炸）
  v_n := case when v_sid ~ '^A\d{3}(141|144)\d{3}$' then v_ay - substr(v_sid, 2, 3)::int + 1 end;

  insert into public.students (id, email, student_id, name, grade, class_name, role, is_transfer)
  values (
    new.id,
    lower(new.email),
    coalesce(v_pre.student_id, v_sid), -- 用 Email 對到的登記：以登記的學號為準
    -- 登記有填姓名就用登記的，否則用 Google 帳號名字
    coalesce(nullif(trim(v_pre.name), ''), new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    -- 延畢（第 5 年以上）算大四；例外名單的學號格式不一，年級留空由學會補
    -- ponytail: 9/1 前就登入的準新生（第 0 年）也留空——填大一會被 9/1 升級多跳一級；空白＝規則從嚴當大一，開學後學會補
    case when v_n >= 1 then '大' || (array['一', '二', '三', '四'])[least(v_n, 4)] end,
    case substr(v_sid, 5, 3) when '141' then '甲' when '144' then '乙' end,
    coalesce(v_pre.role, 'student'),
    coalesce(v_pre.is_transfer, false)
  );
  -- 登記為系學會：順便加進經手人名單
  if coalesce(v_pre.is_sa, false) then
    insert into public.staff_members (student_id, position) values (new.id, coalesce(v_pre.position, ''))
    on conflict (student_id) do nothing;
  end if;
  return new;
end;
$$;

-- 強制 PostgREST 重載 schema cache：新表建好後前端若仍回「Could not find the table ... in the schema cache」就是這個沒跟上
notify pgrst, 'reload schema';
