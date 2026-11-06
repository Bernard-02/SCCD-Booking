-- SCCD Booking — 後台帳號要過 2FA，且登入滿 12 小時權限失效（2026-11-06）
-- 後台在學會共用電腦上用：只有帳密不夠，admin session 也不能一直續。前端（MfaGate、authStorage.isLoginExpired）只是畫面，這裡才是真正的防線：
-- 後台 RPC 與 RLS 的權限判斷全都走 user_role()，只改這支就全部涵蓋。
-- 2FA 看 JWT 的 aal（通過驗證碼才是 aal2，帳密或 Google 登入都只到 aal1）。
-- 不用 Supabase Pro 的 Time-box：那是全專案設定，學生也會一起被登出。
-- 登入時間看 auth.sessions.created_at（token 續期不會變）；session 被刪（別台登入踢掉、登出、改密碼）時權限也立刻失效，不必等 access token 到期。
-- 期限要改：這裡的 interval 和 src/utils/authStorage.ts 的 ADMIN_SESSION_MS 一起改。
-- 使用方式：先上線含 MfaGate 的前端（沒有它就沒地方輸入驗證碼，後台會全部失效），再 SQL Editor 貼上執行（可重複執行）。
-- 還原：重貼 user-role-fix.sql。

-- 先確認讀得到 auth.sessions：user_role() 是全站權限判斷，讀不到會讓所有查詢報錯，這行失敗就整份不套用
select 1 from auth.sessions limit 1;

create or replace function public.user_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select coalesce((
    select case
      when s.role = 'admin' and (
        auth.jwt() ->> 'aal' is distinct from 'aal2'
        or not exists (
          select 1 from auth.sessions a
          where a.id = (auth.jwt() ->> 'session_id')::uuid
            and a.created_at > now() - interval '12 hours'
        )
      ) then 'anon'
      else s.role
    end
    from public.students s
    where s.id = auth.uid()
  ), 'anon');
$$;
