-- 部分時段可借用（2026-11-02）：兩支「逐日」佔用 RPC。前端據此把「你選的區間裡有些天夠、有些天不夠」的
-- 設備卡／地圖格標橘，點了開選段 popup（src/components/common/PartialDialog.tsx），選一段後該類日期改成那段。
-- 原本的 equipment_reserved／space_occupied（整段總量，含待繳押金 on_hold）照舊，兩支並用；
-- 前端抓不到這兩支（尚未執行本檔）會自動退回整段判定、不會壞。在 Supabase SQL Editor 執行。

-- 各設備每天被生效訂單佔用的件數（只回有佔用的天）
create or replace function public.equipment_reserved_daily(p_start date, p_end date)
returns table(item_id text, day date, reserved bigint)
language sql
security definer set search_path = public
stable
as $$
  select oi.item_id, d.day::date as day, sum(oi.quantity)::bigint as reserved
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  cross join lateral generate_series(greatest(o.start_date, p_start), least(o.end_date, p_end), interval '1 day') as d(day)
  where oi.item_type = 'equipment'
    and o.status in ('pending', 'in-progress', 'overdue')
    and o.start_date <= p_end
    and o.end_date >= p_start
  group by oi.item_id, d.day
  order by oi.item_id, d.day;
$$;

-- 各空間（區塊＋教室）被佔用的日子
create or replace function public.space_occupied_daily(p_start date, p_end date)
returns table(item_id text, day date)
language sql
security definer set search_path = public
stable
as $$
  select distinct oi.item_id, d.day::date as day
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  cross join lateral generate_series(greatest(o.start_date, p_start), least(o.end_date, p_end), interval '1 day') as d(day)
  where oi.item_type in ('space-block', 'classroom')
    and o.status in ('pending', 'in-progress', 'overdue')
    and o.start_date <= p_end
    and o.end_date >= p_start;
$$;
