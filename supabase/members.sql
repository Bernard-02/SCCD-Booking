-- =============================================================
-- 2026-10-01 後台會員管理：學生身分標記
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（一次性，可重複執行）
-- 之後「重貼 orders-rpc.sql」——submit_orders 用到這裡的 on_leave／graduated 欄位，必須先存在
-- （順序反了送單會全部失敗）。
--
-- - on_leave（休學）：擋新借（同停權，submit_orders 檢查）；已借的照常歸還／延期。復學取消勾選即恢復
-- - is_transfer（轉學生）：純標記，不影響規則（年級照實際填）
-- - graduated（已畢業，2026-10-04）：**手動標記**，不依年級自動判定（學籍年齡不一、大四未必畢業）。
--   標記後不能登入（前端 authService 擋）——還有東西沒歸還者例外，歸還結案後即停用；submit_orders 擋新單
-- - 系秘＝助教：沿用 role = 'staff'（免押金、送出即租借中），不另設身分
-- - 幹部：沿用 staff_members 表；違規（停權／逾期中／欠罰款）由現有資料即時算，不入庫
-- 寫入權限沿用 schema.sql 的 "students: admin update" policy
-- =============================================================

alter table public.students add column if not exists on_leave boolean not null default false;
alter table public.students add column if not exists is_transfer boolean not null default false;
alter table public.students add column if not exists graduated boolean not null default false;
