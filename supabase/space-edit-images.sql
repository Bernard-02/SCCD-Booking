-- =============================================================
-- 2026-10-01 後台可編輯教室／編號區＋更換圖片
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（一次性）
-- 1) space 加 image_url（教室圖；null＝沿用 /Images/{id}.webp）
-- 2) Storage bucket「images」：公開讀、只有 admin 能寫；限 5MB、jpg/png/webp（server 端把關）
--    設備圖與教室圖共用，路徑 equipment/… 與 space/…
-- =============================================================

alter table public.space add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- 公開 bucket 的讀取走 public URL，不需 select policy；上傳／刪除限 admin
create policy "images: admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'images' and public.user_role() = 'admin')
  with check (bucket_id = 'images' and public.user_role() = 'admin');
