/**
 * 訂單資料來源：Supabase public.orders + order_items
 * RLS：學生只讀得到自己的訂單。
 */

import { useEffect, useState } from 'react'
import { supabase, fetchAllRows } from './supabase'
import type { BookingType } from '../types/equipment'
import { closedKey, dutyHoursText, type ClosedShift, type DutySlot } from '../utils/timeUtils'
import { calcBundles, type Bundle } from '../utils/bundleUtils'
import { serverErrorText } from '../utils/serverErrors'
import { tr } from '../stores/langStore'

export type OrderStatus = 'pending' | 'in-progress' | 'overdue' | 'returned' | 'canceled'

export interface OrderItemRow {
  id: number
  item_type: 'equipment' | 'space-block' | 'classroom'
  item_id: string
  name: string
  quantity: number
  deposit: number
  // 學生改單（modify-order.sql）：changed_at＝送單後加／改過；pickup_pending＝取件後新增、尚未點交
  changed_at: string | null
  pickup_pending: boolean
  handed_over_by: string | null
  days?: string[] | null // 分時段的設備（雷切機）只借這幾天（orders-rpc.sql）；null＝整段每一天
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
  parent_order_id: number | null // 拆單的子單指向根單；押金與罰金都在根單結
  returned_at: string | null     // 實際歸還時間（退押金時試算逾期罰款）
  penalty_total: number | null   // 退押金時學會填的罰金（null = 尚未結算）
  penalty_paid: boolean          // 超過押金的差額是否繳清（false = 欠繳，submit_orders 擋新單）
  // 大量設備預選時段（mass-pickup.sql）：繳押金日＋時段、取件時段（日期＝起租日）
  deposit_date: string | null
  deposit_slot: string | null    // 'HH:MM-HH:MM'
  pickup_slot: string | null
  pickup_date: string | null     // 公休改過的取件日（rules-2026-11.sql）；null＝起租日
  deposit_paid_at: string | null // 已收押金；status 仍為 pending ＝ 已繳待取件
  as_teacher: boolean            // 老師名義：押金 0，老師名稱存 teacher
  proof_path: string | null      // 證明文件（bucket proofs）；老師名義、雷切機一年級的核可
  refunded: number | null        // 已退押金（null＝還沒結；有罰款時是扣完退的）
  items_updated_at: string | null // 學生最後一次改品項（收據／PDF 印出，對照紙本新舊）
  // 學生送出、學會還沒確認的延期申請（partial-extend.sql）；all＝整單延，否則只延 item_ids。逾期、歸還、歸還日變了就自動清掉
  extend_request?: { days: number; item_ids: number[]; all: boolean; at: string } | null
  archived_at?: string | null     // 學期結束從後台訂單頁清掉的（sa-feedback-2026-11.sql）；資料還在
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
  refunded_by: string | null  // 退押金經手幹部（姓名快照）
  penalty_collected_by: string | null // 收罰款經手幹部（姓名快照）
  students: { student_id: string; name: string } | null
}

/**
 * 讀取全部訂單（含品項與借用者姓名學號，新的在前）。
 * 最高權限與學會成員共用（RPC，operator-access.sql）；其他人拿到空清單。
 */
export async function fetchAllOrders(): Promise<AdminOrderRow[]> {
  return fetchAllRows<AdminOrderRow>((from, to) => supabase.rpc('operator_orders').range(from, to))
}

/**
 * 系學會公休（週六日以外），繳押金 24 工作時倒數會跳過整天公休。只休一班的存成 '日期:noon'（見 timeUtils.closedKey）。
 * 讀取失敗時退回空集合（只排除週末），不擋頁面。
 */
let closedDatesCache: Set<string> | null = null
/** 後台改了公休日後呼叫，下次 fetchClosedDates 重抓 */
export const invalidateClosedDates = () => { closedDatesCache = null }
export async function fetchClosedDates(): Promise<Set<string>> {
  if (closedDatesCache) return closedDatesCache
  // select('*')：shift 欄位的 SQL 尚未執行時也能讀（視為整天）
  const { data, error } = await supabase.from('closed_dates').select('*')
  if (error) {
    console.error('讀取公休日失敗:', error.message)
    return new Set()
  }
  closedDatesCache = new Set((data ?? []).map(row => closedKey(row.day as string, row.shift as ClosedShift | undefined)))
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
 * 前台營業時間文字（Info 視窗的工作時間／聯絡方式）：讀後台排的值班時段。
 * undefined＝載入中、null＝尚未排班。模組層快取，開關視窗不重抓；後台改了學生端重新整理生效。
 */
let dutySlotsOnce: Promise<DutySlot[]> | null = null
export function useDutyHours() {
  const [text, setText] = useState<ReturnType<typeof dutyHoursText> | undefined>(undefined)
  useEffect(() => {
    let alive = true
    void (dutySlotsOnce ??= fetchDutySlots()).then(s => { if (alive) setText(dutyHoursText(s)) })
    return () => { alive = false }
  }, [])
  return text
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
 * 後台：修改訂單軟性欄位（原因／班級／老師，學生打錯字時代改；RPC，operator-access.sql）。
 * 硬性資料（日期／品項／狀態／押金）不走這裡，一律走專用 RPC（order-lifecycle 情境 9）。
 */
/** 小量只有 reason；大量／團體三項皆有（不帶的欄位不會被更新） */
// 大量設備待取件時可一併改預選時段（OrderInfoDialog；沒顯示的欄位不送）
export type OrderInfo = {
  reason: string; class_name?: string; teacher?: string
  deposit_date?: string; deposit_slot?: string; pickup_slot?: string
}

export async function adminUpdateOrderInfo(
  rentalNumber: string,
  info: OrderInfo
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('operator_update_order_info', { p_rental_number: rentalNumber, p_info: info })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/**
 * 後台：收押金／取件（僅 admin；handler = 值班經手幹部）。
 * pickup = true：收押金＋取件（或已預繳者取件）→ in-progress；false：只收押金，維持 pending＝已繳待取件
 * depositTotal：已繳待取件的單繳押金後被學生改過品項，取件時記錄現場補收／退還後的押金總額（不帶＝不變）
 */
export async function adminMarkPaid(
  rentalNumber: string,
  handler: string,
  pickup = true,
  depositTotal?: number
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_mark_paid', {
    p_rental_number: rentalNumber,
    p_handler: handler,
    p_pickup: pickup,
    p_deposit_total: depositTotal ?? null
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
  handler: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_mark_returned_partial', {
    p_rental_number: rentalNumber,
    p_item_ids: itemIds,
    p_handler: handler
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 後台：退押金＝結算，填罰金、押金扣完退還，超過的差額記欠繳（整張單還完才能結；partial-extend.sql） */
export async function adminRefundDeposit(
  rentalNumber: string,
  penalty: number,
  handler: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_refund_deposit', {
    p_rental_number: rentalNumber,
    p_penalty: penalty,
    p_handler: handler
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export type HandlerField = 'paid_by' | 'picked_up_by' | 'returned_by' | 'refunded_by' | 'penalty_collected_by'
/**
 * 後台（最高權限）：經手人選錯時直接換人，不動狀態（2026-11-10）。RLS orders: admin all 放行；
 * 學會成員沒有這條權限，更新會是 0 筆，用回傳筆數判斷。
 */
export async function adminSetHandler(
  rentalNumber: string,
  fields: Partial<Record<HandlerField, string>>
): Promise<{ ok: boolean; message?: string }> {
  const { data, error } = await supabase.from('orders').update(fields).eq('rental_number', rentalNumber).select('id')
  if (error) return { ok: false, message: error.message }
  if (!data?.length) return { ok: false, message: '沒有權限更換經手人' }
  return { ok: true }
}

/**
 * 後台（最高權限）：學期結束把已完成的單從訂單頁清掉＝標 archived_at，資料不刪（單號流水靠當年度筆數算，刪了會撞號）。
 * ponytail: id 放在網址的篩選條件裡，一次 200 筆分批送；一學期的單量幾批就完，慢了再改成 RPC
 */
export async function adminArchiveOrders(ids: number[]): Promise<{ ok: boolean; message?: string }> {
  const archived_at = new Date().toISOString()
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from('orders').update({ archived_at }).in('id', ids.slice(i, i + 200))
    if (error) return { ok: false, message: error.message }
  }
  return { ok: true }
}

/** 後台：通過學生的延期申請（這時才真的延、部分延期拆子單；撞期照擋） */
export async function adminApproveExtend(
  rentalNumber: string,
  handler: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_approve_extend', { p_rental_number: rentalNumber, p_handler: handler })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 後台：退回學生的延期申請（照原歸還日歸還；延期權不扣） */
export async function adminRejectExtend(
  rentalNumber: string,
  handler: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_reject_extend', { p_rental_number: rentalNumber, p_handler: handler })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 後台：代取消（只有還沒取件的 pending → canceled；已繳待取件的退押金為現場人工動作。取件後只能歸還） */
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

/** 學生自己取消還沒繳押金的單（佔用立刻釋放；已繳押金的要到學會辦，sa-feedback-2026-11.sql cancel_my_order） */
export async function cancelMyOrder(rentalNumber: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('cancel_my_order', { p_rental_number: rentalNumber })
  if (error) return { ok: false, message: serverErrorText(error.message) }
  return { ok: true }
}

/**
 * 送出延期申請（2026-11-14 起不是直接生效）：學生到學會確認、學會按通過才成立，沒確認就照原歸還日歸還。
 * 全選品項＝整單延期不拆單；部分＝通過時拆子單（單號根單號續流水）
 */
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
  if (error) return { ok: false, message: serverErrorText(error.message) }
  return { ok: true, resultNumber: data as string }
}

/**
 * 學生修改自己的設備訂單（modify-order.sql）：items＝改完後的完整清單。
 * 取件前可增減；取件後只能加（新增的待學會點交）。數量／庫存／押金規則皆由 server 把關。
 */
export async function modifyMyOrder(
  rentalNumber: string,
  items: { item_id: string; quantity: number }[]
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('modify_my_order', {
    p_rental_number: rentalNumber,
    p_items: items
  })
  if (error) return { ok: false, message: serverErrorText(error.message) }
  return { ok: true }
}

/** 學生改取件時段：只有目前的時段碰到公休才能改（rules-2026-11.sql change_my_pickup） */
export async function changeMyPickup(
  rentalNumber: string,
  date: string,
  slot: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('change_my_pickup', {
    p_rental_number: rentalNumber,
    p_date: date,
    p_slot: slot
  })
  if (error) return { ok: false, message: serverErrorText(error.message) }
  return { ok: true }
}

// ---- 證明文件（私有 bucket proofs，路徑 {uid}/…，本人與 admin 讀得到；rules-2026-11.sql）----
export const PROOF_ACCEPT = '.jpg,.jpeg,.png,.pdf'
const PROOF_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

/** 上傳證明文件，回傳路徑（送單時帶給 submit_orders）。訂單沒送出的話檔案留著（ponytail: 量很小，吃緊再清） */
export async function uploadProof(file: File): Promise<{ path?: string; message?: string }> {
  if (!PROOF_TYPES.includes(file.type)) return { message: tr('Only JPG, PNG or PDF files are accepted.', '只接受 JPG、PNG 或 PDF') }
  if (file.size > 10 * 1024 * 1024) return { message: tr('The file must be under 10 MB.', '檔案需小於 10MB') }
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user.id
  if (!uid) return { message: tr('Please log in first.', '請先登入') }
  const path = `${uid}/${Date.now().toString(36)}.${file.name.split('.').pop()?.toLowerCase() ?? 'pdf'}`
  const { error } = await supabase.storage.from('proofs').upload(path, file, { contentType: file.type })
  if (error) return { message: error.message }
  return { path }
}

/** 私有 bucket 要簽短效網址才能開 */
export async function proofUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('proofs').createSignedUrl(path, 300)
  if (error) {
    console.error('讀取證明文件失敗:', error.message)
    return null
  }
  return data.signedUrl
}

/** 後台：點交取件後新增的品項，記錄現場計算後的押金總額（modify-order.sql） */
export async function adminHandoverItems(
  rentalNumber: string,
  handler: string,
  depositTotal: number
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_handover_items', {
    p_rental_number: rentalNumber,
    p_handler: handler,
    p_deposit_total: depositTotal
  })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 學生還要繳的罰款：押金抵完還差的金額，收清前 penalty_paid＝false */
export const penaltyOwed = (o: Pick<OrderRow, 'penalty_total' | 'penalty_paid' | 'deposit_total'>): number =>
  o.penalty_paid === false ? Math.max((o.penalty_total ?? 0) - o.deposit_total, 0) : 0

/** 押金建議值：品項小計（單價×數量，設備套用組合）cap 5,000，同 submit_orders；學會現場計算時預填用 */
export const suggestedDeposit = (
  items: Pick<OrderItemRow, 'item_id' | 'deposit' | 'quantity'>[],
  bundles: Bundle[]
): number =>
  Math.min(calcBundles(items.map(i => ({ id: i.item_id, quantity: i.quantity, deposit: i.deposit })), bundles).deposit, 5000)
