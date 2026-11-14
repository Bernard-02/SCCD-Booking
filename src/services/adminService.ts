/**
 * 後台專用資料操作：公休日（closed_dates）與寒暑假封鎖（rental_blackouts）的 CRUD。
 * 寫入權限由 RLS 把關（只有 admin 能 insert/delete）；前端直接對表操作。
 *
 * ponytail: 新增／刪除後不主動失效 ordersService 內 fetchClosedDates／fetchBlackouts 的
 * module 快取——那兩份快取服務的是「學生下單日曆」，與 admin 同一 session 無關；
 * 學生端重新整理即取得最新。若日後要即時同步，再加快取失效。
 */

import { supabase, fetchAllRows } from './supabase'
import { closedDayImpact, closedKey, daysLabel, dutySlotOptions, fromDateKey, slotClosed, slotLabel, slotStart, toDateKey, type ClosedShift } from '../utils/timeUtils'
import { fetchClosedDates, fetchDutySlots, invalidateClosedDates } from './ordersService'
import type { AdminOrderRow } from './ordersService'
import { loadEquipmentData } from './equipmentService'

/**
 * 大量設備單的核對單（2026-11-09 學會改要試算表）：Apps Script 複製 Drive 裡的範本、填入這張單（程式與部署步驟見 docs/drive-upload-setup.md）。
 * info／items 的 key 對應範本裡的 {{…}}。組合拆成零件逐項列（order_items 原樣），現場是一件一件點的。
 * 每次都是新檔，不覆蓋學會改過的版本。權限由 Apps Script 拿這裡帶的 Supabase token 查 backend_access，前端不放共用密鑰。
 * Content-Type 用 text/plain：Apps Script 不回應 CORS preflight。
 */
export async function createCheckSheet(o: AdminOrderRow): Promise<{ ok: boolean; message: string }> {
  const url = import.meta.env.VITE_DRIVE_UPLOAD_URL
  if (!url) return { ok: false, message: '尚未設定 Google Drive' }
  // 檔名＝起租日＋班級＋使用原因（學會舊表單的命名），在 Drive 依名稱排序就是依日期。班級、原因是學生打的：換行收成空白、太長截斷
  const clean = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim()
  const name = [o.start_date.replace(/-/g, ''), clean(o.class_name), clean(o.reason) || o.rental_number].filter(Boolean).join(' ').slice(0, 60)
  const fmt = (d: string) => d.replace(/-/g, '/')
  try {
    const [equipment, { data: { session } }] = await Promise.all([loadEquipmentData(), supabase.auth.getSession()])
    // 依存放地點、類別排序：同一處的東西排在一起，方便點貨，Apps Script 也才能把相鄰同地點合併成一格
    const rows = o.order_items
      .map(i => ({
        存放地點: equipment[i.item_id]?.location || '—',
        類別: equipment[i.item_id]?.category ?? '—',
        品項: `${i.name}${i.days ? `（${daysLabel(i.days)}）` : ''}${i.pickup_pending ? '（待點交）' : ''}`,
        數量: i.quantity
      }))
      .sort((a, b) => a.存放地點.localeCompare(b.存放地點, 'zh-Hant') || a.類別.localeCompare(b.類別, 'zh-Hant'))
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: session?.access_token,
        name,
        info: {
          單號: o.rental_number,
          借用人: `${o.students?.name ?? '—'} ${o.students?.student_id ?? ''}`.trim(),
          使用班級: o.class_name || '—',
          負責老師: `${o.teacher || '—'}${o.as_teacher ? '（老師名義）' : ''}`,
          借用期間: `${fmt(o.start_date)} – ${fmt(o.end_date)}`,
          取件時段: o.pickup_slot ? slotLabel({ date: o.pickup_date ?? o.start_date, slot: o.pickup_slot }) : '—',
          使用原因: o.reason || '—'
        },
        items: rows.map((r, n) => ({ '#': n + 1, ...r }))
      })
    })
    const out = await res.json() as { error?: string }
    return out.error ? { ok: false, message: `建立試算表失敗（${out.error}）` } : { ok: true, message: `已建立試算表：${name}` }
  } catch {
    return { ok: false, message: '連不上 Google Drive，請稍後再試' }
  }
}

// 不營業日類別（supabase/closed-date-kinds.sql）：學會自己的公休三種＋自動匯入的法定假日。
// 四種對計算的效果都一樣（同週末：倒數／逾期跳過、歸還期限順延），差別只在後台分區與是否發公告。
export type ClosedKind = 'activity' | 'review' | 'other' | 'holiday'
export const CLOSED_KIND_ZH: Record<ClosedKind, string> = {
  activity: '活動', review: '大總評', other: '其他', holiday: '法定假日'
}
export interface ClosedDate { day: string; reason: string | null; kind?: ClosedKind; shift?: ClosedShift } // kind、shift：SQL 執行前不存在
export interface Blackout { id: number; start_date: string; end_date: string; reason: string | null }

export interface StaffDuty { id: number; weekday: number; start_time: string; end_time: string }
export interface StaffMember {
  id: number
  name: string
  studentNo: string // 學號（students.student_id）
  position: string
  duties: StaffDuty[]
}

// ---- 幹部名單（staff_members + staff_duties，見 supabase/staff-members.sql）----
// 收押金／歸還的「值班經手人」選單來源；幹部連結 students（搜學號新增），
// 姓名 join 學生表，還沒啟用的讀預先登記（pending-staff.sql）；訂單上的經手人是姓名快照，刪除幹部不影響歷史紀錄。
export async function listStaff(): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_members')
    .select('id, position, students(name, student_id), login_allowlist(name, student_id), staff_duties(id, weekday, start_time, end_time)')
    .order('id')
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.students?.name ?? r.login_allowlist?.name ?? '',
    studentNo: r.students?.student_id ?? r.login_allowlist?.student_id ?? '',
    position: r.position ?? '',
    duties: ((r.staff_duties ?? []) as StaffDuty[]).sort(
      (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)
    )
  }))
}

export async function addStaffBulk(
  members: { student_id: string; position: string }[] // student_id 為 students.id（uuid）
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('staff_members').insert(members)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function updateStaffPosition(id: number, position: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('staff_members').update({ position }).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 新增值班：一次寫入，陣列順序＝id 先後＝同一班的顯示順序 */
export async function addStaffDuties(
  rows: { staffId: number; weekday: number; start: string; end: string }[] // start／end：'HH:MM'
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from('staff_duties')
    .insert(rows.map(r => ({ staff_id: r.staffId, weekday: r.weekday, start_time: r.start, end_time: r.end })))
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 把值班列改給別人（同一班重排時用，見 AdminHoursPage dutyDiff） */
export async function reassignStaffDuty(id: number, staffId: number): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('staff_duties').update({ staff_id: staffId }).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 刪除值班（一人一筆或整個時段的所有人） */
export async function deleteStaffDuties(ids: number[]): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('staff_duties').delete().in('id', ids)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 改整個時段的起訖（同時段所有人一起改） */
export async function updateStaffDuties(
  ids: number[], start: string, end: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('staff_duties').update({ start_time: start, end_time: end }).in('id', ids)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 批次移出系學會（會員頁選取模式改身份） */
export async function deleteStaffMany(ids: number[]): Promise<{ ok: boolean; message?: string }> {
  if (ids.length === 0) return { ok: true }
  const { error } = await supabase.from('staff_members').delete().in('id', ids)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function deleteStaff(id: number): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('staff_members').delete().eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ---- 會員管理（students；身分欄位見 supabase/members.sql）----
// 幹部沿用 listStaff、違規由訂單即時算（AdminMembersPage），這裡只管 students 本身。
export interface Member {
  id: string // students.id（uuid，= orders.student_id）
  student_id: string // 學號
  name: string
  email: string
  grade: string | null
  class_name: string | null
  phone: string | null
  role: 'student' | 'staff' | 'admin' // staff＝系秘（助教用學生帳號借，2026-11-07）
  account_level: number // 5＝停權
  on_leave?: boolean // 休學：擋新借（members.sql 執行前不存在）
  is_transfer?: boolean // 轉學生：純標記
  graduated?: boolean // 已畢業：不能登入（有未歸還訂單者例外）、不能送新單；手動標記
  dues_paid?: boolean // 系學會費：沒繳不能送單（rules-2026-11.sql）
}

export type MemberFields = Pick<Member, 'grade' | 'class_name' | 'role' | 'on_leave' | 'is_transfer' | 'graduated' | 'dues_paid'>

// 畢業生帳號不刪，累積會破千：分段抓（fetchAllRows）
export async function listMembers(): Promise<Member[]> {
  // select('*')：members.sql 尚未執行時（無 on_leave／is_transfer）也能讀
  return fetchAllRows<Member>((from, to) =>
    supabase.from('students').select('*').order('student_id').range(from, to)
  )
}

/**
 * 學會成員唯讀看會員管理（2026-11-14，sa-feedback-2026-11.sql operator_members）：帳號、預先登記、系學會名單一次拿。
 * students／login_allowlist／staff_members 的 RLS 都只給 admin，學會成員走這支 RPC；值班時段（duties）這頁用不到，不帶
 */
export async function operatorMembers(): Promise<{ members: Member[]; allowlist: AllowEntry[]; staff: StaffMember[] }> {
  const { data, error } = await supabase.rpc('operator_members')
  if (error) throw error
  if (!data) throw new Error('沒有後台權限')
  const d = data as { members: Member[]; allowlist: AllowEntry[]; staff: Omit<StaffMember, 'duties'>[] }
  return { members: d.members, allowlist: d.allowlist, staff: d.staff.map(s => ({ ...s, duties: [] })) }
}

export async function updateMember(id: string, fields: MemberFields): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('students').update(fields).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 批次更新（會員頁選取模式：休學／恢復在學／設為身份） */
export async function updateMembersMany(
  ids: string[],
  fields: Partial<Pick<Member, 'on_leave' | 'graduated' | 'role' | 'is_transfer' | 'dues_paid'>>
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('students').update(fields).in('id', ids)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ---- 停權帳號（account_level = 5，見 supabase/account-suspension.sql；名單在會員管理「違規」篩選）----
/** 解除停權（account_level 5 → 0；繳清／老師通融，supabase/admin-actions.sql） */
export async function unsuspendStudent(studentId: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_unsuspend_student', { p_student_id: studentId })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 刪除帳號＋登記（沒有訂單的才能刪，supabase/admin-delete-member.sql） */
export async function deleteMember(id: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_delete_member', { p_id: id })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ---- 預先登記／登入例外名單（login_allowlist，見 supabase/google-login.sql＋members-v2.sql）----
// 後台「新增會員」寫這裡（帳號要本人第一次 Google 登入才會建）；trigger 在第一次登入時套用登記的姓名／身份。
// 學號不符「A＋入學年＋141／144」的也要先登記才能登入。只在第一次登入（建帳號）時檢查
export interface AllowEntry {
  student_id: string
  note: string | null
  name?: string | null
  email?: string | null
  role?: 'student' | 'staff' | 'admin'
  is_transfer?: boolean
  is_sa?: boolean
  position?: string | null
  grade?: string | null      // 名單的班級（「日媒四乙」拆成 grade＋class_name）；空的由學號推
  class_name?: string | null
  dues_paid?: boolean
}

export async function listAllowlist(): Promise<AllowEntry[]> {
  // select('*')：members-v2.sql 尚未執行時（只有 student_id／note）也能讀
  const { data, error } = await supabase.from('login_allowlist').select('*').order('student_id')
  if (error) throw error
  return (data ?? []) as AllowEntry[]
}

export async function addAllowlist(rows: AllowEntry[]): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('login_allowlist').upsert(rows)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 批次標未啟用者的會費（會員頁選取模式）：本人第一次登入時帶進帳號 */
export async function updateAllowlistDues(studentIds: string[], duesPaid: boolean): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('login_allowlist').update({ dues_paid: duesPaid }).in('student_id', studentIds)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function removeAllowlist(studentId: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('login_allowlist').delete().eq('student_id', studentId)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ---- 通知（notifications；admin 可直接寫入，RLS "notifications: admin insert"）----
// 一人一列：網頁版通知鈴鐺照常讀自己的列（顯示 7 天內）；日後做 App 推播，可在 notifications 的
// insert 掛 Database Webhook → 推播服務，資料模型不用改。
interface NewNotification { student_id: string; type: string; title: string; message: string; link: string | null }
type NotifyResult = { ok: boolean; message?: string; count: number }

async function insertNotifications(rows: NewNotification[]): Promise<NotifyResult> {
  if (rows.length === 0) return { ok: true, count: 0 }
  const { error } = await supabase.from('notifications').insert(rows)
  if (error) return { ok: false, message: error.message, count: 0 }
  return { ok: true, count: rows.length }
}

/** 全站通知：發給所有非管理員帳號（type 'announcement'）；目前由公休日 template 觸發。
 *  收件人分段抓（fetchAllRows），破千也不漏 */
export async function broadcastNotification(message: string): Promise<NotifyResult> {
  let ids: { id: string }[]
  try {
    ids = await fetchAllRows<{ id: string }>((from, to) =>
      supabase.from('students').select('id').neq('role', 'admin').order('id').range(from, to)
    )
  } catch (err) {
    return { ok: false, message: (err as Error).message, count: 0 }
  }
  return insertNotifications(
    ids.map(s => ({ student_id: s.id, type: 'announcement', title: '系學會公告', message, link: null }))
  )
}

// 受影響的訂單＝待繳押金／租借中（逾期單的天數本來就跳過公休，不另通知）
interface ActiveOrder {
  student_id: string; rental_number: string; status: string; start_date: string; end_date: string
  pickup_date: string | null; pickup_slot: string | null
  deposit_date: string | null; deposit_slot: string | null; deposit_paid_at: string | null
}
async function fetchActiveOrders() {
  return fetchAllRows<ActiveOrder>((from, to) =>
    supabase
      .from('orders')
      .select('student_id, rental_number, status, start_date, end_date, pickup_date, pickup_slot, deposit_date, deposit_slot, deposit_paid_at')
      .in('status', ['pending', 'in-progress'])
      .order('id')
      .range(from, to)
  )
}

/**
 * 新增公休後處理受影響的訂單（2026-11-07 Bernard 定）：
 * - 大量設備的取件時段碰到公休：通知附「修改取件日」（連結 /profile?pickup=單號），沒改的話取件日 19:00 後自動取消
 * - 還沒繳押金的繳押金時段碰到公休：順延到隔天的值班時段，晚於取件就併到取件時段（取件不得早於繳押金）
 * - 歸還期限順延（新期限同 effectiveReturnDeadline）
 * when＝通知裡的日期文字；rows＝closedRangeRows 的結果。補登過去的日子不處理
 */
export async function notifyClosedAffected(
  rows: { day: string; shift: ClosedShift }[],
  when: string,
  reason: string
): Promise<NotifyResult> {
  const added = rows.filter(r => r.day >= toDateKey(new Date())).map(r => closedKey(r.day, r.shift))
  if (added.length === 0) return { ok: true, count: 0 }
  try {
    const [orders, closed, duties] = await Promise.all([fetchActiveOrders(), fetchClosedDates(), fetchDutySlots()])
    const addedSet = new Set(added)
    const label = `${when} 系學會公休${reason ? `（${reason}）` : ''}`
    const out: NewNotification[] = []
    for (const o of orders) {
      const parts: string[] = []
      const pickupDay = o.pickup_date ?? o.start_date
      const pickupHit = o.status === 'pending' && !!o.pickup_slot && slotClosed(pickupDay, o.pickup_slot, addedSet)
      if (pickupHit) parts.push('取件時段遇到公休，請修改取件日，沒改的話訂單會在取件日 19:00 後自動取消')
      if (o.status === 'pending' && !o.deposit_paid_at && o.deposit_date && o.deposit_slot && slotClosed(o.deposit_date, o.deposit_slot, addedSet)) {
        const from = fromDateKey(o.deposit_date)
        from.setDate(from.getDate() + 1)
        const until = new Date(from)
        until.setDate(until.getDate() + 14)
        let next = dutySlotOptions(duties, from, until, closed)[0]
        if (next && o.pickup_slot && !pickupHit && slotStart(next.date, next.slot) > slotStart(pickupDay, o.pickup_slot)) {
          next = { date: pickupDay, slot: o.pickup_slot }
        }
        if (next) {
          const { error } = await supabase.from('orders').update({ deposit_date: next.date, deposit_slot: next.slot }).eq('rental_number', o.rental_number)
          if (error) throw error
          parts.push(`繳押金時段順延至 ${slotLabel(next)}`)
        }
      }
      const newDue = closedDayImpact(o, added, closed)
      if (newDue) parts.push(`歸還期限順延至 ${newDue} 19:00`)
      if (parts.length > 0) {
        out.push({
          student_id: o.student_id, type: 'warning', title: '公休異動',
          message: `${label}，您的訂單 ${o.rental_number} ${parts.join('；')}。`,
          link: pickupHit ? `/profile?pickup=${encodeURIComponent(o.rental_number)}` : '/profile'
        })
      }
    }
    return insertNotifications(out)
  } catch (e) {
    return { ok: false, message: (e as Error).message, count: 0 }
  }
}

/** 新增寒暑假封鎖後通知與封鎖期重疊的訂單（新單送出時已擋，這裡處理「先借、後公布封鎖」的單） */
export async function notifyBlackoutAffected(start: string, end: string, reason: string): Promise<NotifyResult> {
  try {
    const orders = (await fetchActiveOrders()).filter(o => o.start_date <= end && o.end_date >= start)
    return insertNotifications(orders.map(o => ({
      student_id: o.student_id, type: 'warning', title: '封鎖期異動',
      message: `${start}～${end} 為${reason || '寒暑假'}封鎖期，您的訂單 ${o.rental_number}（${o.start_date}～${o.end_date}）` +
        '與封鎖期重疊，請儘速與系學會聯繫確認取件／歸還安排。',
      link: '/profile'
    })))
  } catch (e) {
    return { ok: false, message: (e as Error).message, count: 0 }
  }
}

const SHIFT_ZH = { noon: '午班', evening: '晚班' }
/** 公休全站公告（template，不另外手寫）：「10/16（週五）系學會因大總評公休，…」；只休一班或跨多天時標出時段 */
export async function announceClosed(
  start: string, end: string, startShift: keyof typeof SHIFT_ZH, endShift: keyof typeof SHIFT_ZH, reasonText: string
): Promise<NotifyResult> {
  const label = (key: string) => {
    const d = new Date(`${key}T00:00:00`)
    return `${d.getMonth() + 1}/${d.getDate()}（週${'日一二三四五六'[d.getDay()]}）`
  }
  if (start === end) {
    const shift = startShift === endShift ? SHIFT_ZH[startShift] : ''
    return broadcastNotification(`${label(start)}${shift}系學會因${reasonText}公休，${shift ? '該時段' : '當天'}不提供借用與歸還服務。`)
  }
  const from = startShift === 'evening' ? '晚班' : ''
  const to = endShift === 'noon' ? '午班' : ''
  return broadcastNotification(`${label(start)}${from}至${label(end)}${to}系學會因${reasonText}公休，期間不提供借用與歸還服務。`)
}

// ---- 公休日／法定假日（closed_dates）----
export async function listClosedDates(): Promise<ClosedDate[]> {
  // select('*')：kind 欄位的 SQL 尚未執行時也能讀（視為 other）
  const { data, error } = await supabase.from('closed_dates').select('*').order('day')
  if (error) throw error
  return (data ?? []) as ClosedDate[]
}

/** 一次新增多天；區間裡已有的日子（法定假日、之前的休息日）保留原本那筆 */
export async function addClosedDates(
  rows: { day: string; shift: ClosedShift }[], kind: ClosedKind, reason: string | null
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('closed_dates').upsert(rows.map(r => ({ ...r, kind, reason })), { onConflict: 'day', ignoreDuplicates: true })
  if (error) return { ok: false, message: error.message }
  invalidateClosedDates()
  return { ok: true }
}

/**
 * 法定假日自動匯入：資料來源 ruyut/TaiwanCalendar（政府行政機關辦公日曆表整理，jsDelivr CDN）。
 * 只取平日的放假日（週末本來就不營業）；補班日不管——學會週末一律不營業。
 * 每個年度只在「該年還沒有任何法定假日」時匯入一次：學會刪掉某天（照常營業）不會被補回。
 * 今年＋明年各檢查一次；明年資料尚未公布（404）就略過，下次再試。由 AdminLayout 進後台時觸發。
 * 資料對補假日只寫「補假」，看不出補哪個假：往前後 3 天找最近有名字的假日，寫成「國慶日補假」；
 * 已匯入過、仍寫「補假」的列也順手改掉（2026-10-26 前匯入的資料）。
 */
type TwCalDay = { date: string; week: string; isHoliday: boolean; description: string }
const holidayName = (days: TwCalDay[], i: number) => {
  const desc = days[i].description
  if (desc !== '補假') return desc || '國定假日'
  for (const k of [1, -1, 2, -2, 3, -3]) {
    const near = days[i + k]
    if (near?.isHoliday && near.description && near.description !== '補假') return `${near.description}補假`
  }
  return desc
}
export async function autoImportHolidays(): Promise<void> {
  const year = new Date().getFullYear()
  for (const y of [year, year + 1]) {
    const { data, error } = await supabase
      .from('closed_dates').select('day, reason').eq('kind', 'holiday')
      .gte('day', `${y}-01-01`).lte('day', `${y}-12-31`)
    if (error) continue // kind 欄位不存在（SQL 未執行）
    const imported = (data ?? []).length > 0
    const stale = (data ?? []).filter(r => r.reason === '補假').map(r => r.day as string)
    if (imported && stale.length === 0) continue
    try {
      const res = await fetch(`https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${y}.json`)
      if (!res.ok) continue
      const days = (await res.json()) as TwCalDay[] // 全年每一天依序一筆
      const rows = days.flatMap((r, i) =>
        r.isHoliday && r.week !== '六' && r.week !== '日'
          ? [{ day: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`, kind: 'holiday' as const, reason: holidayName(days, i) }]
          : []
      )
      if (!imported) {
        // 已有同日的學會公休就保留原本那筆
        await supabase.from('closed_dates').upsert(rows, { onConflict: 'day', ignoreDuplicates: true })
      } else {
        for (const day of stale) {
          const r = rows.find(x => x.day === day)
          if (r && r.reason !== '補假') await supabase.from('closed_dates').update({ reason: r.reason }).eq('day', day)
        }
      }
      invalidateClosedDates()
    } catch {
      // 網路錯誤：下次進後台再試
    }
  }
}

export async function deleteClosedDates(days: string[]): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('closed_dates').delete().in('day', days)
  if (error) return { ok: false, message: error.message }
  invalidateClosedDates()
  return { ok: true }
}

// ---- 寒暑假封鎖 ----
export async function listBlackouts(): Promise<Blackout[]> {
  const { data, error } = await supabase
    .from('rental_blackouts')
    .select('id, start_date, end_date, reason')
    .order('start_date')
  if (error) throw error
  return (data ?? []) as Blackout[]
}

export async function addBlackout(
  startDate: string,
  endDate: string,
  reason: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from('rental_blackouts')
    .insert({ start_date: startDate, end_date: endDate, reason: reason || null })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function deleteBlackout(id: number): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('rental_blackouts').delete().eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ---- 設備管理（equipment 表；下架＝is_active=false 軟性停用，不實刪）----
// 前台 equipmentService 只撈 is_active=true 且有 module 快取——後台改完，
// 學生端重新整理即生效（同公休日的快取政策）。

export interface AdminEquipment {
  id: string
  name: string
  en_name: string | null
  category: string
  sub_category: string | null
  location: string | null
  original_quantity: number
  deposit: number
  image_url: string | null
  is_active: boolean
}

export async function listEquipmentAdmin(): Promise<AdminEquipment[]> {
  const { data, error } = await supabase
    .from('equipment')
    .select('id, name, en_name, category, sub_category, location, original_quantity, deposit, image_url, is_active')
    .order('category')
    .order('id')
  if (error) throw error
  return (data ?? []) as AdminEquipment[]
}

export interface EquipmentFields {
  name: string
  en_name: string | null
  category: string
  original_quantity: number
  deposit: number
}

// ponytail: 後台只填「總量」，存檔時同步寫入 stock_quantity——所有 RPC（submit_orders／延期／部分歸還）
// 與前台都讀 stock_quantity 當可借池，且從不扣減（可借數＝池 − 訂單佔用，即時算），
// 兩欄在 seed 全數相等。若日後要記「線下借出不在架上」的差額，再把在庫欄開回來。
const withStock = (f: EquipmentFields) => ({ ...f, stock_quantity: f.original_quantity })

export async function addEquipment(fields: EquipmentFields): Promise<{ ok: boolean; message?: string; id?: string }> {
  // seed 的 id 是 '{分頁slug}-{名稱hash}'；後台新增用 'custom-' 前綴＋時間戳，不會與 seed 撞號
  const id = `custom-${Date.now().toString(36)}`
  const { error } = await supabase.from('equipment').insert({ id, ...withStock(fields) })
  if (error) return { ok: false, message: error.message }
  return { ok: true, id }
}

export async function updateEquipment(
  id: string,
  fields: EquipmentFields
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('equipment').update(withStock(fields)).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export { imageSrc } from './equipmentService'

export async function setEquipmentActive(id: string, active: boolean): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('equipment').update({ is_active: active }).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 批次上／下架（後台選取模式） */
export async function setEquipmentActiveMany(ids: string[], active: boolean): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('equipment').update({ is_active: active }).in('id', ids)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ---- 設備組合（equipment-bundles.sql）：湊滿一組押金只收一組、算 1 件 ----
// 前台 loadBundles 有模組快取：改完學生端重新整理生效（同設備管理）

export interface BundleFields {
  name: string
  en_name: string | null
  deposit: number
  items: { equipmentId: string; quantity: number }[]
}

/** 後台清單用：組合欄位＋id＋圖片（bundle-images.sql；null＝沒圖） */
export type AdminBundle = BundleFields & { id: string; image_url: string | null }

export async function listBundlesAdmin(): Promise<AdminBundle[]> {
  // select('*')：en_name 欄位的 SQL 尚未執行時也不會整頁讀取失敗
  const { data, error } = await supabase
    .from('equipment_bundles')
    .select('*, equipment_bundle_items(equipment_id, quantity)')
    .order('created_at')
  if (error) throw error
  return (data ?? []).map(b => ({
    id: b.id,
    name: b.name,
    en_name: b.en_name ?? null,
    deposit: b.deposit,
    image_url: b.image_url ?? null,
    items: (b.equipment_bundle_items ?? []).map((i: { equipment_id: string; quantity: number }) => ({ equipmentId: i.equipment_id, quantity: i.quantity }))
  }))
}

/** id＝null 新增；組合與品項一次寫完（admin_save_bundle RPC，不會只存一半），英文名稱接著寫。回傳組合 id（新增後上傳圖片用） */
export async function saveBundle(id: string | null, f: BundleFields): Promise<{ ok: boolean; message?: string; id?: string }> {
  const { data, error } = await supabase.rpc('admin_save_bundle', {
    p_id: id,
    p_name: f.name,
    p_deposit: f.deposit,
    p_items: f.items.map(i => ({ equipment_id: i.equipmentId, quantity: i.quantity }))
  })
  if (error) return { ok: false, message: error.message }
  const savedId = (data as string | null) ?? id ?? undefined
  const { error: nameError } = await supabase.from('equipment_bundles').update({ en_name: f.en_name }).eq('id', savedId)
  if (nameError) return { ok: false, message: nameError.message }
  return { ok: true, id: savedId }
}

/** 刪除組合（品項跟著 cascade）。回傳被刪掉的那一列，給復原用 */
export async function deleteBundle(id: string): Promise<{ ok: boolean; message?: string; row?: Record<string, unknown> }> {
  const { data, error } = await supabase.from('equipment_bundles').delete().eq('id', id).select().single()
  if (error) return { ok: false, message: error.message }
  return { ok: true, row: data }
}

/**
 * 復原剛刪掉的組合：deleteBundle 回傳的那一列＋品項照原樣寫回（id、建立時間＝湊組優先序、圖片都不變）。
 * ponytail: 兩次 insert 不是同一個 transaction；第二次失敗會留一個沒有品項的組合（不影響計算，後台看得到、可再刪）
 */
export async function restoreBundle(row: Record<string, unknown>, items: BundleFields['items']): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('equipment_bundles').insert(row)
  if (error) return { ok: false, message: error.message }
  const { error: itemsError } = await supabase.from('equipment_bundle_items')
    .insert(items.map(i => ({ bundle_id: row.id, equipment_id: i.equipmentId, quantity: i.quantity })))
  if (itemsError) return { ok: false, message: itemsError.message }
  return { ok: true }
}

// ---- 空間管理（space 表；開放 toggle＋教室名稱／押金／圖片＋編號區整區押金）----
export interface AdminSpace {
  id: string
  name: string | null
  en_name?: string | null // supabase/item-en-names.sql 加的欄位
  area: string
  deposit: number
  image_url?: string | null // supabase/space-edit-images.sql 加的欄位
  is_active: boolean
}

export async function listSpacesAdmin(): Promise<AdminSpace[]> {
  // select('*')：image_url 欄位的 SQL 尚未執行時也不會整頁讀取失敗
  const { data, error } = await supabase
    .from('space')
    .select('*')
    .order('area')
    .order('id')
  if (error) throw error
  return (data ?? []) as AdminSpace[]
}

export async function setSpaceActive(id: string, active: boolean): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('space').update({ is_active: active }).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 批次開放／關閉（後台選取模式） */
export async function setSpaceActiveMany(ids: string[], active: boolean): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('space').update({ is_active: active }).in('id', ids)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 教室：名稱＋英文名稱＋押金（前台 SpacePage 以 space 表為準） */
export async function updateSpace(id: string, fields: { name: string; en_name: string | null; deposit: number }): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('space').update(fields).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 編號區押金以「區」為單位（規則：後陽台 2000、其餘 1000）——整區一次改，同區不會不一致 */
export async function updateAreaDeposit(area: string, deposit: number): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('space').update({ deposit }).eq('area', area)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ---- 圖片（Storage bucket「images」，見 supabase/space-edit-images.sql）----
/** 上傳圖片並寫回該列 image_url。檔名帶時間戳：每次換圖都是新網址，
 *  避開 CDN／瀏覽器快取到舊圖，也不需 upsert 權限。
 *  ponytail: 舊圖不刪（留孤兒檔）；Storage 空間吃緊再加清理 */
export async function uploadImage(
  table: 'equipment' | 'space' | 'equipment_bundles',
  id: string,
  file: File
): Promise<{ ok: boolean; message?: string }> {
  if (!['image/jpeg', 'image/png'].includes(file.type)) return { ok: false, message: '只接受 JPG／PNG 圖片' }
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: '圖片需小於 5MB' }
  const path = `${table}/${id}-${Date.now().toString(36)}.${file.type.split('/')[1] ?? 'jpg'}`
  const bucket = supabase.storage.from('images')
  const { error: upErr } = await bucket.upload(path, file, { contentType: file.type })
  if (upErr) return { ok: false, message: upErr.message }
  const { error } = await supabase.from(table).update({ image_url: bucket.getPublicUrl(path).data.publicUrl }).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ---- 空間地圖（值班段唯讀，2026-09-29 新規則 #6）：指定日期各空間被誰借走 ----
export interface SpaceOccupant {
  itemId: string
  itemType: 'space-block' | 'classroom'
  rentalNumber: string
  status: string
  startDate: string
  endDate: string
  studentName: string
  studentNo: string
}

/** 查指定日期（YYYY-MM-DD）佔用中的空間與借用人；最高權限與學會成員共用（operator-access.sql） */
export async function fetchSpaceOccupancy(date: string): Promise<SpaceOccupant[]> {
  const { data, error } = await supabase.rpc('operator_space_occupancy', { p_date: date })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    itemId: r.item_id,
    itemType: r.item_type,
    rentalNumber: r.rental_number,
    status: r.status,
    startDate: r.start_date,
    endDate: r.end_date,
    studentName: r.student_name,
    studentNo: r.student_no
  }))
}
