/**
 * 重複下單的前端提前提示（UX 用）
 * 真正把關在 submit_orders RPC（rental-rules §6）；此處以同樣規則比對自己在 Supabase 的生效訂單，
 * 讓學生在加入清單時就知道，不必等到送單才被擋。
 */

import type { BookingType } from '../types/equipment'
import type { OrderRow } from '../services/ordersService'
import { toDateKey } from '../components/cart/cartHelpers'

/** 與 submit_orders 相同：佔用中的狀態才算 */
const ACTIVE_STATUSES = new Set(['pending', 'in-progress', 'overdue'])

export const checkDuplicateOrder = (
  myOrders: OrderRow[],
  startDate: Date | null,
  endDate: Date | null,
  bookingType: BookingType
): { isDuplicate: boolean; message: string } => {
  // 規則：同一時段（起訖完全相同）僅能有一張小量訂單；大量／部分重疊／錯開皆允許
  if (!startDate || !endDate || bookingType !== 'little') return { isDuplicate: false, message: '' }

  const start = toDateKey(startDate)
  const end = toDateKey(endDate)
  const duplicated = myOrders.some(
    o =>
      ACTIVE_STATUSES.has(o.status) &&
      o.booking_type === 'little' &&
      o.start_date === start &&
      o.end_date === end
  )

  return duplicated
    ? { isDuplicate: true, message: '此時段已有一張小量訂單，不可重複租借。' }
    : { isDuplicate: false, message: '' }
}
