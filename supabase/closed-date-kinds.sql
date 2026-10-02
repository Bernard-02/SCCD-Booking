-- =============================================================
-- 2026-10-02 不營業日分類：closed_dates 加 kind
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（一次性，可重複執行）
--
-- - activity（學會辦活動）／review（大總評）／other（其他，reason 填原因）：學會自己的公休，
--   後台新增時自動發全站公告 template（Facebook 請同步發）＋通知受影響訂單
-- - holiday（法定假日）：後台自動匯入（adminService.autoImportHolidays，每年一次），reason＝假日名稱
-- 四種對計算效果相同（同週末：倒數／逾期跳過、歸還期限順延），所有既有函式照讀 closed_dates，不用改。
-- 舊資料一律視為 other。
-- =============================================================

alter table public.closed_dates add column if not exists kind text not null default 'other';

alter table public.closed_dates drop constraint if exists closed_dates_kind_check;
alter table public.closed_dates add constraint closed_dates_kind_check
  check (kind in ('activity', 'review', 'other', 'holiday'));
