-- =============================================================
-- 2026-09-29 新規則 #1：A508 與後陽台預設不開放租借
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（一次性）
-- 之後的開關由後台「空間管理」頁 toggle（space.is_active），不用再跑 SQL
-- =============================================================

update public.space
set is_active = false
where id = 'A508' or area = 'back-terrace';
