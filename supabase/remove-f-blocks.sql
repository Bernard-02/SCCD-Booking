-- =============================================================
-- 2026-10-24 刪掉 F1–F6（Venues 表有、A5F 地圖上沒有這些格子；seed 時先 is_active=false 待確認，Bernard 確認沒有 F 區）
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（一次性，可重複執行）
-- seed-spaces.sql 已同步拿掉這六列，重新 seed 不會再出現
-- =============================================================

delete from public.space where id in ('F1', 'F2', 'F3', 'F4', 'F5', 'F6') and area = 'unknown';
