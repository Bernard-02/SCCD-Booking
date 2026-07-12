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
