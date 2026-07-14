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
