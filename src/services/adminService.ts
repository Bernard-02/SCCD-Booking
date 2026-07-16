/**
 * 後台專用資料操作：公休日（closed_dates）與寒暑假封鎖（rental_blackouts）的 CRUD。
 * 寫入權限由 RLS 把關（只有 admin 能 insert/delete）；前端直接對表操作。
 *
 * ponytail: 新增／刪除後不主動失效 ordersService 內 fetchClosedDates／fetchBlackouts 的
 * module 快取——那兩份快取服務的是「學生下單日曆」，與 admin 同一 session 無關；
 * 學生端重新整理即取得最新。若日後要即時同步，再加快取失效。
 */

import { supabase } from './supabase'

export interface ClosedDate { day: string; reason: string | null }
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

// ---- 公休日 ----
export async function listClosedDates(): Promise<ClosedDate[]> {
  const { data, error } = await supabase.from('closed_dates').select('day, reason').order('day')
  if (error) throw error
  return (data ?? []) as ClosedDate[]
}

export async function addClosedDate(day: string, reason: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('closed_dates').insert({ day, reason: reason || null })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
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
