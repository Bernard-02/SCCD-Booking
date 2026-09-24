/** orderValidation 測試：重複下單前端提示須與 submit_orders 規則一致 */

import { describe, it, expect } from 'vitest'
import { checkDuplicateOrder } from './orderValidation'
import type { OrderRow } from '../services/ordersService'

const order = (over: Partial<OrderRow>): OrderRow => ({
  id: 1,
  rental_number: '2026-0001',
  start_date: '2026-10-05',
  end_date: '2026-10-07',
  booking_type: 'little',
  status: 'pending',
  deposit_total: 0,
  has_extended: false,
  reason: null,
  created_at: '2026-10-01T00:00:00Z',
  order_items: [],
  ...over
})

const start = new Date(2026, 9, 5)
const end = new Date(2026, 9, 7)

describe('checkDuplicateOrder（與 submit_orders 同規則）', () => {
  it('同時段已有生效中的小量單 → 擋', () => {
    expect(checkDuplicateOrder([order({})], start, end, 'little').isDuplicate).toBe(true)
  })

  it('既有訂單已取消或已歸還 → 不擋', () => {
    const orders = [order({ status: 'canceled' }), order({ status: 'returned' })]
    expect(checkDuplicateOrder(orders, start, end, 'little').isDuplicate).toBe(false)
  })

  it('大量單不受限（新單或既有單為大量）', () => {
    expect(checkDuplicateOrder([order({})], start, end, 'mass-personal').isDuplicate).toBe(false)
    expect(checkDuplicateOrder([order({ booking_type: 'mass-group' })], start, end, 'little').isDuplicate).toBe(false)
  })

  it('時段部分重疊或錯開 → 不擋', () => {
    expect(checkDuplicateOrder([order({ end_date: '2026-10-08' })], start, end, 'little').isDuplicate).toBe(false)
  })

  it('未選日期 → 不擋', () => {
    expect(checkDuplicateOrder([order({})], null, null, 'little').isDuplicate).toBe(false)
  })
})
