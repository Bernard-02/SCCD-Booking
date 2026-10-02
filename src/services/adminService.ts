/**
 * 後台專用資料操作：公休日（closed_dates）與寒暑假封鎖（rental_blackouts）的 CRUD。
 * 寫入權限由 RLS 把關（只有 admin 能 insert/delete）；前端直接對表操作。
 *
 * ponytail: 新增／刪除後不主動失效 ordersService 內 fetchClosedDates／fetchBlackouts 的
 * module 快取——那兩份快取服務的是「學生下單日曆」，與 admin 同一 session 無關；
 * 學生端重新整理即取得最新。若日後要即時同步，再加快取失效。
 */

import { supabase } from './supabase'
import { closedDayImpact, toDateKey } from '../utils/timeUtils'

// 不營業日類別（supabase/closed-date-kinds.sql）：學會自己的公休三種＋自動匯入的法定假日。
// 四種對計算的效果都一樣（同週末：倒數／逾期跳過、歸還期限順延），差別只在後台分區與是否發公告。
export type ClosedKind = 'activity' | 'review' | 'other' | 'holiday'
export const CLOSED_KIND_ZH: Record<ClosedKind, string> = {
  activity: '學會辦活動', review: '大總評', other: '其他', holiday: '法定假日'
}
export interface ClosedDate { day: string; reason: string | null; kind?: ClosedKind } // kind：SQL 執行前不存在
export interface Blackout { id: number; start_date: string; end_date: string; reason: string | null }
export interface SuspendedStudent { student_id: string; name: string }

export interface StaffDuty { id: number; weekday: number; start_time: string; end_time: string }
export interface StaffMember {
  id: number
  name: string
  studentNo: string // 學號（students.student_id）
  position: string
  duties: StaffDuty[]
}
export interface StudentHit { id: string; student_id: string; name: string }

// ---- 幹部名單（staff_members + staff_duties，見 supabase/staff-members.sql）----
// 收押金／歸還的「值班經手人」選單來源；幹部連結 students（搜學號新增），
// 姓名 join 學生表；訂單上的經手人是姓名快照，刪除幹部不影響歷史紀錄。
export async function listStaff(): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_members')
    .select('id, position, students(name, student_id), staff_duties(id, weekday, start_time, end_time)')
    .order('id')
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.students?.name ?? '',
    studentNo: r.students?.student_id ?? '',
    position: r.position ?? '',
    duties: ((r.staff_duties ?? []) as StaffDuty[]).sort(
      (a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)
    )
  }))
}

/** 依學號精確查學生（貼上名單匯入用；一次查一批） */
export async function lookupStudents(studentIds: string[]): Promise<StudentHit[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, student_id, name')
    .in('student_id', studentIds)
  if (error) throw error
  return (data ?? []) as StudentHit[]
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

export async function addStaffDuty(
  staffId: number,
  weekday: number,
  start: string, // 'HH:MM'
  end: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from('staff_duties')
    .insert({ staff_id: staffId, weekday, start_time: start, end_time: end })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function deleteStaffDuty(id: number): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('staff_duties').delete().eq('id', id)
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
  role: 'student' | 'staff' | 'admin' // staff＝系秘（同助教）
  account_level: number // 5＝停權
  on_leave?: boolean // 休學：擋新借（members.sql 執行前不存在）
  is_transfer?: boolean // 轉學生：純標記
}

export type MemberFields = Pick<Member, 'grade' | 'class_name' | 'role' | 'on_leave' | 'is_transfer'>

// ponytail: 一次撈全部（Supabase 預設上限 1000 列，系上規模夠用；破千再改分頁查詢）
export async function listMembers(): Promise<Member[]> {
  // select('*')：members.sql 尚未執行時（無 on_leave／is_transfer）也能讀
  const { data, error } = await supabase.from('students').select('*').order('student_id')
  if (error) throw error
  return (data ?? []) as Member[]
}

export async function updateMember(id: string, fields: MemberFields): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('students').update(fields).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ---- 停權帳號（account_level = 5，見 supabase/account-suspension.sql）----
export async function listSuspendedStudents(): Promise<SuspendedStudent[]> {
  const { data, error } = await supabase
    .from('students')
    .select('student_id, name')
    .eq('account_level', 5)
    .order('student_id')
  if (error) throw error
  return (data ?? []) as SuspendedStudent[]
}

/** 解除停權（account_level 5 → 0；繳清／老師通融，supabase/admin-actions.sql） */
export async function unsuspendStudent(studentId: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_unsuspend_student', { p_student_id: studentId })
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

/** 全站通知：發給所有非管理員帳號（type 'announcement'，鈴鐺標「公告」）；目前由公休日 template 觸發
 *  ponytail: 收件人一次撈（Supabase 預設上限 1000 列，同 listMembers），破千再分批 */
export async function broadcastNotification(message: string): Promise<NotifyResult> {
  const { data, error } = await supabase.from('students').select('id').neq('role', 'admin')
  if (error) return { ok: false, message: error.message, count: 0 }
  return insertNotifications(
    (data ?? []).map(s => ({ student_id: s.id, type: 'announcement', title: '系學會公告', message, link: null }))
  )
}

// 受影響的訂單＝待繳押金／租借中（逾期單的天數本來就跳過公休，不另通知）
async function fetchActiveOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('student_id, rental_number, start_date, end_date')
    .in('status', ['pending', 'in-progress'])
  if (error) throw error
  return (data ?? []) as { student_id: string; rental_number: string; start_date: string; end_date: string }[]
}

/** 新增公休日後通知受影響訂單：取件日剛好公休、或歸還期限因此順延（新期限同 effectiveReturnDeadline） */
export async function notifyClosedDateAffected(day: string, reason: string): Promise<NotifyResult> {
  if (day < toDateKey(new Date())) return { ok: true, count: 0 } // 補登過去的公休日不通知
  try {
    const [orders, closed] = await Promise.all([fetchActiveOrders(), listClosedDates()])
    const after = new Set(closed.map(c => c.day))
    const label = `${day} 系學會公休${reason ? `（${reason}）` : ''}`
    const rows: NewNotification[] = []
    for (const o of orders) {
      const { pickup, newDue } = closedDayImpact(o, day, after)
      const parts: string[] = []
      if (pickup) parts.push('原定當天取件，請與系學會確認取件時間')
      if (newDue) parts.push(`歸還期限順延至 ${newDue} 19:00`)
      if (parts.length > 0) {
        rows.push({
          student_id: o.student_id, type: 'warning', title: '公休異動',
          message: `${label}，您的訂單 ${o.rental_number} ${parts.join('；')}。`, link: '/profile'
        })
      }
    }
    return insertNotifications(rows)
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

/** 公休日全站公告（template，不另外手寫）：「10/16（週五）系學會因大總評公休，…」 */
export async function announceClosedDate(day: string, reasonText: string): Promise<NotifyResult> {
  const d = new Date(`${day}T00:00:00`)
  const date = `${d.getMonth() + 1}/${d.getDate()}（週${'日一二三四五六'[d.getDay()]}）`
  return broadcastNotification(`${date}系學會因${reasonText}公休，當天不提供借用與歸還服務。`)
}

// ---- 公休日／法定假日（closed_dates）----
export async function listClosedDates(): Promise<ClosedDate[]> {
  // select('*')：kind 欄位的 SQL 尚未執行時也能讀（視為 other）
  const { data, error } = await supabase.from('closed_dates').select('*').order('day')
  if (error) throw error
  return (data ?? []) as ClosedDate[]
}

export async function addClosedDate(day: string, kind: ClosedKind, reason: string | null): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('closed_dates').insert({ day, kind, reason })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/**
 * 法定假日自動匯入：資料來源 ruyut/TaiwanCalendar（政府行政機關辦公日曆表整理，jsDelivr CDN）。
 * 只取平日的放假日（週末本來就不營業）；補班日不管——學會週末一律不營業。
 * 每個年度只在「該年還沒有任何法定假日」時匯入一次：學會刪掉某天（照常營業）不會被補回。
 * 今年＋明年各檢查一次；明年資料尚未公布（404）就略過，下次再試。由 AdminLayout 進後台時觸發。
 */
export async function autoImportHolidays(): Promise<void> {
  const year = new Date().getFullYear()
  for (const y of [year, year + 1]) {
    const { data, error } = await supabase
      .from('closed_dates').select('day').eq('kind', 'holiday')
      .gte('day', `${y}-01-01`).lte('day', `${y}-12-31`).limit(1)
    if (error || (data ?? []).length > 0) continue // kind 欄位不存在（SQL 未執行）或已匯入
    try {
      const res = await fetch(`https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${y}.json`)
      if (!res.ok) continue
      const days = (await res.json()) as { date: string; week: string; isHoliday: boolean; description: string }[]
      const rows = days
        .filter(r => r.isHoliday && r.week !== '六' && r.week !== '日')
        .map(r => ({
          day: `${r.date.slice(0, 4)}-${r.date.slice(4, 6)}-${r.date.slice(6, 8)}`,
          kind: 'holiday' as const,
          reason: r.description || '國定假日'
        }))
      // 已有同日的學會公休就保留原本那筆
      await supabase.from('closed_dates').upsert(rows, { onConflict: 'day', ignoreDuplicates: true })
    } catch {
      // 網路錯誤：下次進後台再試
    }
  }
}

export async function deleteClosedDate(day: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('closed_dates').delete().eq('day', day)
  if (error) return { ok: false, message: error.message }
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
    .select('id, name, category, sub_category, location, original_quantity, deposit, image_url, is_active')
    .order('category')
    .order('id')
  if (error) throw error
  return (data ?? []) as AdminEquipment[]
}

export interface EquipmentFields {
  name: string
  category: string
  original_quantity: number
  deposit: number
}

// ponytail: 後台只填「總量」，存檔時同步寫入 stock_quantity——所有 RPC（submit_orders／延期／部分歸還）
// 與前台都讀 stock_quantity 當可借池，且從不扣減（可借數＝池 − 訂單佔用，即時算），
// 兩欄在 seed 全數相等。若日後要記「線下借出不在架上」的差額，再把在庫欄開回來。
const withStock = (f: EquipmentFields) => ({ ...f, stock_quantity: f.original_quantity })

export async function addEquipment(fields: EquipmentFields): Promise<{ ok: boolean; message?: string }> {
  // seed 的 id 是 '{分頁slug}-{名稱hash}'；後台新增用 'custom-' 前綴＋時間戳，不會與 seed 撞號
  const id = `custom-${Date.now().toString(36)}`
  const { error } = await supabase.from('equipment').insert({ id, ...withStock(fields) })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

export async function updateEquipment(
  id: string,
  fields: EquipmentFields
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('equipment').update(withStock(fields)).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 圖片路徑補前導斜線：seed 存相對路徑 'Images/…'，在 /admin/* 底下會解析錯 */
export const imageSrc = (url: string | null | undefined, fallback = '/Images/Extension Cord.webp'): string => {
  if (!url) return fallback
  return url.startsWith('/') || url.startsWith('http') ? url : `/${url}`
}

export async function setEquipmentActive(id: string, active: boolean): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('equipment').update({ is_active: active }).eq('id', id)
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

// ---- 空間管理（space 表；開放 toggle＋教室名稱／押金／圖片＋編號區整區押金）----
export interface AdminSpace {
  id: string
  name: string | null
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

/** 教室：名稱＋押金（前台 SpacePage 以 space 表為準） */
export async function updateSpace(id: string, fields: { name: string; deposit: number }): Promise<{ ok: boolean; message?: string }> {
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
  table: 'equipment' | 'space',
  id: string,
  file: File
): Promise<{ ok: boolean; message?: string }> {
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

/** 查指定日期（YYYY-MM-DD）佔用中的空間與借用人；RLS admin 可讀全部訂單 */
export async function fetchSpaceOccupancy(date: string): Promise<SpaceOccupant[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('item_id, item_type, orders!inner(rental_number, status, start_date, end_date, students!inner(name, student_id))')
    .in('item_type', ['space-block', 'classroom'])
    .in('orders.status', ['pending', 'in-progress', 'overdue'])
    .lte('orders.start_date', date)
    .gte('orders.end_date', date)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    itemId: r.item_id,
    itemType: r.item_type,
    rentalNumber: r.orders?.rental_number ?? '',
    status: r.orders?.status ?? '',
    startDate: r.orders?.start_date ?? '',
    endDate: r.orders?.end_date ?? '',
    studentName: r.orders?.students?.name ?? '',
    studentNo: r.orders?.students?.student_id ?? ''
  }))
}
