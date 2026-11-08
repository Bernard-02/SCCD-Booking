-- SCCD Booking — 學校 Google 帳號登入（2026-10-24 Bernard 定）
-- ※ 2026-10-25 起 handle_new_user 以 members-v2.sql 為準（封閉名單：只有後台登記過的才能登入，規則 2 的自動放行取消）；
--   本檔不用再跑（members-v2.sql 自己建表）；重跑會蓋掉封閉名單，要跑的話接著再跑一次 members-v2.sql。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。Google Cloud／Supabase 的一次性設定見 docs/google-login-setup.md，
-- 做完前端的 Google 登入鈕才會通。
--
-- 規則：
--   1. 只收學校網域 gm／gm1／gm2.usc.edu.tw（網域依入學年輪替，三個都收；@ 前面就是學號）
--   2. 學號 A＋入學年 3 碼＋班級代碼 141（甲）／144（乙）＋座號 3 碼 → 第一次登入自動建立學生資料
--      （跳號不用管：不存在的學號沒有學校 Google 帳號，登不進來）
--   3. 不符規則但該能借的（碩士〔格式待確認〕、轉系生、雙主修、系秘…）→ 後台會員管理加進例外名單
--   4. 年級／班別由學號給初值（後台仍可改；之後照 9/1 自動升級），姓名用 Google 帳號名字
--   5. 密碼帳號（admin sccdsa、舊測試帳號）照舊，trigger 走原本的 metadata 流程
--   不符的帳號在 trigger raise exception → Supabase 不建帳號，前端收到 server_error 顯示「請用本系學校帳號」

-- ---------- 1. 例外名單 ----------
create table if not exists public.login_allowlist (
  student_id text primary key,              -- 大寫，例：M113144001
  note text,                                -- 例外原因（碩士、轉系…）
  created_at timestamptz not null default now()
);
alter table public.login_allowlist enable row level security;
drop policy if exists "login_allowlist: admin all" on public.login_allowlist;
create policy "login_allowlist: admin all" on public.login_allowlist for all using (public.user_role() = 'admin');

-- ---------- 2. 註冊 trigger：Google 帳號套用學號規則 ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_sid text;
  v_ay int; -- 目前學年度（民國）；9/1 換學年，同 promote-grades-yearly 排程（UTC 9/1 00:00）
  v_n int;  -- 第幾年
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
  if v_sid !~ '^A\d{3}(141|144)\d{3}$'
     and not exists (select 1 from public.login_allowlist where student_id = v_sid) then
    raise exception '此帳號不是本系學生';
  end if;

  v_ay := extract(year from now() at time zone 'UTC')::int - 1911
          - case when extract(month from now() at time zone 'UTC') < 9 then 1 else 0 end;
  -- 只有符合規則的學號才推年級（例外名單的學號格式不一，substr 轉數字會炸）
  v_n := case when v_sid ~ '^A\d{3}(141|144)\d{3}$' then v_ay - substr(v_sid, 2, 3)::int + 1 end;

  insert into public.students (id, email, student_id, name, grade, class_name)
  values (
    new.id,
    lower(new.email),
    v_sid,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    -- 延畢（第 5 年以上）算大四；例外名單的學號格式不一，年級留空由學會補
    -- ponytail: 9/1 前就登入的準新生（第 0 年）也留空——填大一會被 9/1 升級多跳一級；空白＝規則從嚴當大一，開學後學會補
    case when v_n >= 1 then '大' || (array['一', '二', '三', '四'])[least(v_n, 4)] end,
    case substr(v_sid, 5, 3) when '141' then '甲' when '144' then '乙' end
  );
  return new;
end;
$$;
