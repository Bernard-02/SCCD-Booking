-- SCCD Booking — 後台可改的文字（2026-11-02）
-- 使用教學／系學會／誰做的系統／聯絡方式／延期規則的說明文字，後台「文字內容」頁編輯。
-- key 與內建預設在 src/data/siteContent.ts；表裡沒有的 key 或空白＝用內建文字。架構（段落、順序）固定在程式裡。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。

create table if not exists public.site_content (
  key text primary key,
  zh text not null default '',
  en text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;

drop policy if exists "site_content: public read" on public.site_content;
create policy "site_content: public read" on public.site_content
  for select using (true);

drop policy if exists "site_content: admin write" on public.site_content;
create policy "site_content: admin write" on public.site_content
  for all using (public.user_role() = 'admin');
