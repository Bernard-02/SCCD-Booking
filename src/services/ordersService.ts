/**
 * 訂單資料來源：Supabase public.orders + order_items
 * RLS：學生只讀得到自己的訂單。
 */

import { supabase } from './supabase'
import type { BookingType } from '../types/equipment'

export type OrderStatus = 'pending' | 'in-progress' | 'overdue' | 'returned' | 'canceled'

export interface OrderItemRow {
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
  created_at: string
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

/** 後台：確認收押金（pending → in-progress，僅 admin；handler = 值班經手幹部） */
export async function adminMarkPaid(
  rentalNumber: string,
  handler: string
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('admin_mark_paid', {
    p_rental_number: rentalNumber,
    p_handler: handler
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
