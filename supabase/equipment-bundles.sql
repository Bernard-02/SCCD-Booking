-- SCCD Booking — 設備組合（2026-10-22 Bernard 定）
-- 後台設定「哪些設備湊成一組、一組押金多少」：同一張設備單湊滿一組 → 押金只收一組，
-- 小量 9 件額度／大量 10 件門檻也只算 1 件；湊不滿（例：少一個支架）照單件押金與件數計。小量、大量都適用。
-- 同一設備可屬多個組合：依建立順序貪婪湊組（前端 src/utils/bundleUtils.ts 同演算法，改一邊要改另一邊）。
-- 使用方式：SQL Editor 貼上執行一次（可重複執行）；之後重貼 orders-rpc.sql 與 modify-order.sql（兩者呼叫本檔函式）。

create table if not exists public.equipment_bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  deposit int not null check (deposit >= 0),   -- 一組的押金
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_bundle_items (
  bundle_id uuid not null references public.equipment_bundles (id) on delete cascade,
  equipment_id text not null references public.equipment (id),
  quantity int not null check (quantity > 0),  -- 一組需要幾個
  primary key (bundle_id, equipment_id)
);

alter table public.equipment_bundles enable row level security;
alter table public.equipment_bundle_items enable row level security;

-- 同 equipment：公開可讀（購物車算押金要用），只有 admin 可改
drop policy if exists "equipment_bundles: public read" on public.equipment_bundles;
create policy "equipment_bundles: public read" on public.equipment_bundles for select using (true);
drop policy if exists "equipment_bundles: admin write" on public.equipment_bundles;
create policy "equipment_bundles: admin write" on public.equipment_bundles for all using (public.user_role() = 'admin');
drop policy if exists "equipment_bundle_items: public read" on public.equipment_bundle_items;
create policy "equipment_bundle_items: public read" on public.equipment_bundle_items for select using (true);
drop policy if exists "equipment_bundle_items: admin write" on public.equipment_bundle_items;
create policy "equipment_bundle_items: admin write" on public.equipment_bundle_items for all using (public.user_role() = 'admin');

-- ---------- 件數＋押金（未 cap 5,000）----------
-- p_items＝[{item_id, quantity, deposit?}]（submit_orders／modify_my_order 的設備清單；拆單時傳 order_items 含押金快照）。
-- 單件押金：有帶 deposit 用它（訂單當時的價格），沒帶讀 equipment 表；空間品項不在任何組合裡、一律照單件。
-- 回傳：o_units 件數（整組算 1）、o_deposit 押金、o_set_deposit 其中湊成組的押金、o_left 湊組後剩下的單件 {item_id: 數量}
drop function if exists public.equipment_bundle_calc(jsonb); -- 回傳欄位有增加，需先刪（呼叫端都是執行時才查，不受影響）
create or replace function public.equipment_bundle_calc(
  p_items jsonb, out o_units int, out o_deposit int, out o_set_deposit int, out o_left jsonb)
language plpgsql stable
set search_path = public
as $$
declare
  v_left jsonb;   -- item_id → 湊組後剩餘數量
  v_dep jsonb;    -- item_id → 單件押金快照（有帶才有）
  v_b record;
  v_sets int;
begin
  o_units := 0;
  o_deposit := 0;
  select coalesce(jsonb_object_agg(s.id, s.q), '{}'), coalesce(jsonb_object_agg(s.id, s.d) filter (where s.d is not null), '{}')
    into v_left, v_dep
    from (select i ->> 'item_id' as id, sum((i ->> 'quantity')::int) as q, max((i ->> 'deposit')::int) as d
            from jsonb_array_elements(coalesce(p_items, '[]')) i group by 1) s;

  for v_b in select b.id, b.deposit from public.equipment_bundles b order by b.created_at loop
    select min(coalesce((v_left ->> bi.equipment_id)::int, 0) / bi.quantity) into v_sets
      from public.equipment_bundle_items bi where bi.bundle_id = v_b.id;
    continue when coalesce(v_sets, 0) <= 0;
    select v_left || jsonb_object_agg(bi.equipment_id, (v_left ->> bi.equipment_id)::int - v_sets * bi.quantity)
      into v_left
      from public.equipment_bundle_items bi where bi.bundle_id = v_b.id;
    o_units := o_units + v_sets;
    o_deposit := o_deposit + v_sets * v_b.deposit;
  end loop;

  o_set_deposit := o_deposit;
  o_left := v_left;
  select o_units + coalesce(sum(l.value::int), 0),
         o_deposit + coalesce(sum(l.value::int * coalesce((v_dep ->> l.key)::int, e.deposit, 0)), 0)
    into o_units, o_deposit
    from jsonb_each_text(v_left) l
    left join public.equipment e on e.id = l.key;
end;
$$;

-- ---------- 後台：新增／編輯組合（一次寫完組合與品項，不會只存一半）----------
-- p_id＝null 新增；p_items＝[{equipment_id, quantity}]。權限靠 RLS（admin write）
create or replace function public.admin_save_bundle(p_id uuid, p_name text, p_deposit int, p_items jsonb)
returns void
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
end;
$$;
