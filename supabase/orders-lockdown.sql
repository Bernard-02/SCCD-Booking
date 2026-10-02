-- =============================================================
-- 2026-10-01 訂單寫入收斂：學生不可直接寫 orders／order_items
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（一次性，可重複執行）
--
-- 原 schema 給學生「insert own」，可繞過 submit_orders 直接塞訂單
-- （自訂狀態、押金 0、不檢查庫存／衝突／封鎖）。前台送單一律走 submit_orders RPC
-- （security definer，不受 RLS 影響），不需要這兩條；移除後學生對訂單只剩「讀自己的」。
-- 學生本來就沒有 update／delete 權限；後台修改借用資訊走 `orders: admin all`。
-- =============================================================

drop policy if exists "orders: insert own" on public.orders;
drop policy if exists "order_items: insert via own order" on public.order_items;
