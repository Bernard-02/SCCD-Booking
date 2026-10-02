/**
 * 訂單資料來源：Supabase public.orders + order_items
 * RLS：學生只讀得到自己的訂單。
 */

import { supabase } from './supabase'
import type { BookingType } from '../types/equipment'
import type { DutySlot } from '../utils/timeUtils'

export type OrderStatus = 'pending' | 'in-progress' | 'overdue' | 'returned' | 'canceled'

export interface OrderItemRow {
  id: number
  item_type: 'equipment' | 'space-block' | 'classroom'
  item_id: string
  name: string
  quantity: number
  deposit: number
}

export interface OrderRow {
  id: number
  rental_number: string
  start_date: string
  end_date: string
  booking_type: BookingType
  status: OrderStatus
  deposit_total: number
  has_extended: boolean
  reason: string | null
  class_name: string | null      // 大量／團體必填：使用班級
  teacher: string | null         // 大量／團體必填：負責老師
  created_at: string
  penalty_total: number | null   // 歸還時凍結的最終罰款（null = 尚未結算）
  penalty_paid: boolean          // 罰款是否已繳清（false = 欠繳，submit_orders 擋新單）
  // 大量設備預選時段（mass-pickup.sql）：繳押金日＋時段、取件時段（日期＝起租日）
  deposit_date: string | null
  deposit_slot: string | null    // 'HH:MM-HH:MM'
  pickup_slot: string | null
  deposit_paid_at: string | null // 已收押金；status 仍為 pending ＝ 已繳待取件
  order_items: OrderItemRow[]
}

/** 讀取目前登入者的所有訂單（含品項，新的在前） */
export async function fetchMyOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as OrderRow[]
}

/** 後台用：含借用者姓名／學號與經手人的訂單列 */
export interface AdminOrderRow extends OrderRow {
  student_id: string
  paid_by: string | null      // 收押金經手幹部（姓名快照）
  picked_up_by: string | null // 取件經手幹部（大量設備先繳後取時才與 paid_by 不同）
  returned_by: string | null  // 歸還經手幹部（姓名快照）
  students: { student_id: string; name: string } | null
}

/**
 * 讀取全部訂單（含品項與借用者資訊，新的在前）。
 * 僅 admin 讀得到全部（RLS `orders: admin all`）；非 admin 只會拿到自己的。
 */
export async function fetchAllOrders(): Promise<AdminOrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), students(student_id, name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AdminOrderRow[]
}

/**
 * 系學會臨時公休日（週六日以外），繳押金 24 工作時倒數會跳過這些日期。
 * 讀取失敗時退回空集合（只排除週末），不擋頁面。
 */
let closedDatesCache: Set<string> | null = null
export async function fetchClosedDates(): Promise<Set<string>> {
  if (closedDatesCache) return closedDatesCache
  const { data, error } = await supabase.from('closed_dates').select('day')
  if (error) {
    console.error('讀取公休日失敗:', error.message)
    return new Set()
  }
  closedDatesCache = new Set((data ?? []).map(row => row.day as string))
  return closedDatesCache
}

/**
 * 系學會值班時段（星期＋起訖，不含幹部個資；RPC duty_slots，見 mass-pickup.sql）。
 * 大量設備選繳押金／取件時段用。讀取失敗回空陣列（選單顯示「無可選時段」）。
 */
export async function fetchDutySlots(): Promise<DutySlot[]> {
  const { data, error } = await supabase.rpc('duty_slots')
  if (error) {
    console.error('讀取值班時段失敗:', error.message)
    return []
  }
  return (data ?? []) as DutySlot[]
}

/**
 * 寒暑假封鎖區間（情境 11-a）：學生不可租借的日期範圍。
 * 前端日曆據此把封鎖日期標為不可選；server 端 submit_orders 亦擋 student（防線）。
 * 讀取失敗時退回空陣列（不擋日曆），server 端仍會攔。
 */
let blackoutsCache: { start: string; end: string }[] | null = null
export async function fetchBlackouts(): Promise<{ start: string; end: string }[]> {
  if (blackoutsCache) return blackoutsCache
  const { data, error } = await supabase
    .from('rental_blackouts')
    .select('start_date, end_date')
  if (error) {
    console.error('讀取封鎖區間失敗:', error.message)
    return []
  }
  blackoutsCache = (data ?? []).map(row => ({
    start: row.start_date as string,
    end: row.end_date as string
  }))
  return blackoutsCache
}

/**
 * 後台：修改訂單軟性欄位（原因／班級／老師，學生打錯字時代改）。
 * 直接 update 表：RLS 只有 `orders: admin all` 允許更新，學生端無 update 權限、前台也無編輯介面。
 * 硬性資料（日期／品項／狀態／押金）不走這裡，一律走專用 RPC（order-lifecycle 情境 9）。
 */
/** 小量只有 reason；大量／團體三項皆有（不帶的欄位不會被更新） */
export type OrderInfo = { reason: string; class_name?: string; teacher?: string }

export async function adminUpdateOrderInfo(
  rentalNumber: string,
  info: OrderInfo
): Promise<{ ok: boolean; message?: string }> {
  // select().single()：RLS 擋下或單號不存在時 update 會「成功但 0 列」，這樣才會報錯
  const { error } = await supabase.from('orders').update(info).eq('rental_number', rentalNumber).select('id').single()
  if (error) return { ok: false, message: error.code === 'PGRST116' ? '訂單不存在或無修改權限' : error.message }
  return { ok: true }
}

/**
 * 後台：收押金／取件（僅 admin；handler = 值班經手幹部）。
 * pickup = true：收押金＋取件（或已預繳者取件）→ in-progress；false：只收押金，維持 pending＝已繳待取件
 */
export async function adminMarkPaid(
  rentalNumber: string,
  handler: string,
  pickup = true
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_mark_paid', {
    p_rental_number: rentalNumber,
    p_handler: handler,
    p_pickup: pickup
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 後台：整單歸還（in-progress/overdue → returned，寫入確認罰款與經手人，僅 admin） */
export async function adminMarkReturned(
  rentalNumber: string,
  penalty: number,
  handler: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_mark_returned', {
    p_rental_number: rentalNumber,
    p_penalty: penalty,
    p_handler: handler
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 延期自己的訂單（RPC：僅限租借中、未延期過、1-7 天） */
export async function extendMyOrder(
  rentalNumber: string,
  days: number
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('extend_my_order', {
    p_rental_number: rentalNumber,
    p_days: days
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/**
 * 後台：歸還（支援部分歸還）。勾「已歸還」品項——全勾＝整單歸還；
 * 部分＝已還留原單結案、未還拆子單續租（supabase/partial-extend.sql）。
 */
export async function adminMarkReturnedPartial(
  rentalNumber: string,
  itemIds: number[],
  penalty: number,
  handler: string,
  penaltyPaid: boolean
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_mark_returned_partial', {
    p_rental_number: rentalNumber,
    p_item_ids: itemIds,
    p_penalty: penalty,
    p_handler: handler,
    p_penalty_paid: penaltyPaid
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 後台：代取消（pending／in-progress → canceled；in-progress 退押金為現場人工動作） */
export async function adminCancelOrder(
  rentalNumber: string,
  handler: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_cancel_order', {
    p_rental_number: rentalNumber,
    p_handler: handler
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 後台：代客延期（不受僅乙次／前三天限制；撞期照擋；overdue 延期後回 in-progress） */
export async function adminExtendOrder(
  rentalNumber: string,
  days: number,
  handler: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_extend_order', {
    p_rental_number: rentalNumber,
    p_days: days,
    p_handler: handler
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 後台：收罰款（欠繳 → 繳清，解除擋單；情境 13） */
export async function adminCollectPenalty(
  rentalNumber: string,
  handler: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_collect_penalty', {
    p_rental_number: rentalNumber,
    p_handler: handler
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// 學年升級（情境 12）改為 pg_cron 每年 9/1 自動（promote_grades_core）；
// 需手動補跑時在 Studio 執行 select public.admin_promote_grades();

/** 逐品項檢查延期撞期（前台部分延期勾選介面用；supabase/partial-extend.sql） */
export interface ExtendCheckItem {
  id: number
  name: string
  extendable: boolean
}
export async function checkExtendItems(
  rentalNumber: string,
  days: number
): Promise<ExtendCheckItem[] | null> {
  const { data, error } = await supabase.rpc('extend_check', {
    p_rental_number: rentalNumber,
    p_days: days
  })
  if (error) {
    console.error('延期撞期檢查失敗:', error.message)
    return null
  }
  return ((data ?? []) as { oi_id: number; oi_name: string; extendable: boolean }[]).map(r => ({
    id: r.oi_id,
    name: r.oi_name,
    extendable: r.extendable
  }))
}

/** 延期（支援部分延期）：全選品項＝整單延期不拆單；部分＝拆子單（單號根單號續流水） */
export async function extendMyOrderPartial(
  rentalNumber: string,
  days: number,
  itemIds: number[]
): Promise<{ ok: boolean; message?: string; resultNumber?: string }> {
  const { data, error } = await supabase.rpc('extend_my_order_partial', {
    p_rental_number: rentalNumber,
    p_days: days,
    p_item_ids: itemIds
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true, resultNumber: data as string }
}
