-- SCCD Booking — 段落型說明頁（2026-11-03）：ⓘ 使用教學／系學會
-- 一頁＝一串段落；一段＝標題＋一串積木（blocks jsonb：[{kind, zh, en, url}]，kind＝text／list／titled／link／contact）。
-- 後台「文字內容」頁：段落清單拖曳排序、點一列右側面板改標題與積木。
-- 表裡該頁沒有任何列＝前台用程式內建段落（src/data/siteSections.ts）；全部刪光儲存也等於回內建。
-- 欄位型的（聯絡方式／關於／延期規則）仍在 site_content（site-content.sql）。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）。舊 site_content 裡 guide.*／sa.* 的列已不再讀取，留著無妨。

create table if not exists public.site_sections (
  id bigint generated always as identity primary key,
  page text not null,                       -- 'guide' | 'sa'
  position int not null,
  title_zh text not null default '',
  title_en text not null default '',
  blocks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 升級：11-03 第一版（kind／body_zh／body_en／url 一段一種）已建過表的話，補 blocks 欄、舊欄位併成一個積木、再刪舊欄位
alter table public.site_sections add column if not exists blocks jsonb not null default '[]'::jsonb;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'site_sections' and column_name = 'kind'
  ) then
    update public.site_sections
      set blocks = jsonb_build_array(jsonb_build_object('kind', kind, 'zh', body_zh, 'en', body_en, 'url', url))
      where blocks = '[]'::jsonb;
    alter table public.site_sections
      drop column kind, drop column body_zh, drop column body_en, drop column url;
  end if;
end $$;

create index if not exists site_sections_page_idx on public.site_sections (page, position);

alter table public.site_sections enable row level security;

drop policy if exists "site_sections: public read" on public.site_sections;
create policy "site_sections: public read" on public.site_sections
  for select using (true);

drop policy if exists "site_sections: admin write" on public.site_sections;
create policy "site_sections: admin write" on public.site_sections
  for all using (public.user_role() = 'admin');

-- 整頁一次寫入：刪掉該頁舊列、依陣列順序重插（順序＝陣列順序）
create or replace function public.save_site_sections(p_page text, p_sections jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if public.user_role() <> 'admin' then
    raise exception '僅限管理員';
  end if;
  delete from public.site_sections where page = p_page;
  insert into public.site_sections (page, position, title_zh, title_en, blocks)
  select p_page, ord - 1,
         coalesce(s ->> 'title_zh', ''), coalesce(s ->> 'title_en', ''),
         coalesce(s -> 'blocks', '[]'::jsonb)
  from jsonb_array_elements(p_sections) with ordinality as t(s, ord);
end;
$$;
