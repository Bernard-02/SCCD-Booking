-- SCCD Booking — 收罰款／欠繳擋單（情境 13）＋學年升級（情境 12），2026-09-26 定案
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。
-- 搭配：orders-rpc.sql 的 submit_orders 有對應修改（欠繳擋單＋助教直借），需一併重貼；
--       partial-extend.sql 的 admin_mark_returned_partial 加了 p_penalty_paid 參數，需一併重貼。

-- ---------- 1. 罰款繳納欄位 ----------
-- penalty_paid：罰款是否已繳清。預設 true（無罰款或當場繳清都算 true）；
-- 歸還時勾「未當場繳清」才會是 false → submit_orders 擋新單直到收罰款。
alter table public.orders add column if not exists penalty_paid boolean not null default true;
alter table public.orders add column if not exists penalty_collected_by text; -- 收罰款經手幹部（姓名快照）

-- ---------- 2. 收罰款（僅 admin）----------
create or replace function public.admin_collect_penalty(p_rental_number text, p_handler text default null)
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
    set penalty_paid = true,
        penalty_collected_by = p_handler
    where rental_number = p_rental_number
      and coalesce(penalty_total, 0) > 0
      and penalty_paid = false
    returning student_id, penalty_total into v_student, v_amount;

  if not found then
    raise exception '此訂單沒有未繳罰款';
  end if;

  insert into public.notifications (student_id, type, title, message, link)
  values (v_student, 'success', '罰款已繳清',
          '訂單 ' || p_rental_number || ' 的罰款 NT$ ' || v_amount || ' 已繳清，可正常預約。', '/profile');
end;
$$;

-- ---------- 3. 學年升級（pg_cron 每年 9/1 自動；情境 12，2026-09-26 改為自動）----------
-- grade 慣例（同 gradeUtils.ts）：'1'-'4' 或「大一」-「大四」、碩士「碩一」「碩二」。
-- 大四／碩二不動（畢業班處理待細定，帳號留存由人工清理）；grade 未填不動。
-- 個別學生調整（延畢、休學）過渡期在 Studio 改 grade，之後併入後台帳號管理。

-- 核心（無權限檢查）：只給 pg_cron 與下方 admin 包裝呼叫，撤銷 API 端執行權
create or replace function public.promote_grades_core()
returns int
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
begin
  update public.students
    set grade = case grade
      when '1' then '2'
      when '2' then '3'
      when '3' then '4'
      when '大一' then '大二'
      when '大二' then '大三'
      when '大三' then '大四'
      when '碩一' then '碩二'
      else grade
    end
    where role = 'student'
      and grade in ('1', '2', '3', '大一', '大二', '大三', '碩一');

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.promote_grades_core() from public, anon, authenticated;

-- 手動補跑用（僅 admin；正常年份不需要，cron 沒跑到才用）
create or replace function public.admin_promote_grades()
returns int
language plpgsql
security definer set search_path = public
as $$
begin
  if public.user_role() <> 'admin' then
    raise exception '僅限管理員';
  end if;
  return public.promote_grades_core();
end;
$$;

-- 排程：每年 9/1 00:00 UTC（台灣 08:00）自動升級（同名 schedule 重複執行會覆蓋）
create extension if not exists pg_cron;
select cron.schedule('promote-grades-yearly', '0 0 1 9 *',
  $$select public.promote_grades_core()$$);
