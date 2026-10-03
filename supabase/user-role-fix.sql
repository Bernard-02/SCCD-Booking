-- SCCD Booking — 修正：未登入／查無學生列時 user_role() 回傳 'anon'，不再是 NULL（2026-10-03）
-- 原因：後台 RPC 用 `if public.user_role() <> 'admin' then raise ...` 擋非管理員，
-- 但 NULL <> 'admin' 結果是 NULL，plpgsql 的 if 視為不成立 → 未登入的請求（只帶前端公開的 anon key）
-- 會直接跳過檢查，可呼叫 admin_mark_paid／admin_mark_returned_partial／admin_cancel_order 等。
-- 改成 coalesce 後全部 `<> 'admin'` 檢查即正確擋下；`= 'admin'`／`= 'student'`／`= 'staff'` 的判斷結果不變。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。

create or replace function public.user_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select role from public.students where id = auth.uid()), 'anon');
$$;
