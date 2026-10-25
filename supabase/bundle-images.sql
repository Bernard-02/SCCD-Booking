-- =============================================================
-- 2026-10-24 組合也有圖片＋後台圖片只收 JPG／PNG
-- 使用方式：Supabase Dashboard → SQL Editor → 貼上 → Run（一次性，可重複執行）
-- 1) equipment_bundles 加 image_url（後台「新增／修改組合」對話框上傳，路徑 equipment_bundles/…，同 images bucket）
-- 2) admin_save_bundle 改回傳組合 id：新增後接著上傳圖片要用（回傳型別變了，必須先 drop）
-- 3) images bucket 的 MIME 白名單拿掉 webp（前端 IMAGE_ACCEPT／uploadImage 同步只收 jpg、png）
-- =============================================================

alter table public.equipment_bundles add column if not exists image_url text;

update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png'] where id = 'images';

drop function if exists public.admin_save_bundle(uuid, text, int, jsonb);

-- p_id＝null 新增；p_items＝[{equipment_id, quantity}]。權限靠 user_role()。回傳組合 id（新增＝新 id、修改＝原 id）
create or replace function public.admin_save_bundle(p_id uuid, p_name text, p_deposit int, p_items jsonb)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_id uuid := p_id;
begin
  if public.user_role() <> 'admin' then
    raise exception '沒有權限';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception '請輸入組合名稱';
  end if;
  if p_deposit is null or p_deposit < 0 then
    raise exception '押金不可為負';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception '組合至少需要一項設備';
  end if;

  if v_id is null then
    insert into public.equipment_bundles (name, deposit) values (trim(p_name), p_deposit) returning id into v_id;
  else
    update public.equipment_bundles set name = trim(p_name), deposit = p_deposit where id = v_id;
    if not found then
      raise exception '組合不存在';
    end if;
    delete from public.equipment_bundle_items where bundle_id = v_id;
  end if;

  insert into public.equipment_bundle_items (bundle_id, equipment_id, quantity)
  select v_id, i ->> 'equipment_id', (i ->> 'quantity')::int
    from jsonb_array_elements(p_items) i;

  return v_id;
end;
$$;
