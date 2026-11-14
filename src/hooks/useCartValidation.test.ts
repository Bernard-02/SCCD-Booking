/**
 * useCartValidation 測試：結帳前四項驗證（大量滿 10 件、過期、缺貨、借用資訊）
 */

import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCartValidation } from './useCartValidation'
import type { CartItem } from '../types/equipment'

const item = (overrides: Partial<CartItem> = {}): CartItem => ({
  id: 'tripod',
  name: '腳架',
  category: 'equipment',
  deposit: 500,
  image: '',
  quantity: 1,
  startDate: '2099-01-01',
  endDate: '2099-01-03',
  bookingType: 'little',
  ...overrides
})

const run = (
  cart: CartItem[],
  bookingDetails: Record<string, { reason: string }> = {},
  stock: Record<string, number> = { tripod: 10 }
) =>
  renderHook(() =>
    useCartValidation({
      cart,
      bookingDetails,
      getOriginalQuantity: id => stock[id] ?? 0,
      getCartQuantity: id =>
        cart.filter(i => i.id === id).reduce((s, i) => s + i.quantity, 0)
    })
  ).result.current

describe('大量租借滿 10 件', () => {
  it('mass-personal 不足 10 件 → 無效', () => {
    const { cartValidation } = run([item({ bookingType: 'mass-personal', quantity: 5 })])
    expect(cartValidation.valid).toBe(false)
    expect(cartValidation.message).toContain('10 件')
  })

  it('mass-personal 滿 10 件 → 有效', () => {
    const { cartValidation } = run([item({ bookingType: 'mass-personal', quantity: 10 })])
    expect(cartValidation.valid).toBe(true)
  })

  it('小量不受 10 件限制', () => {
    const { cartValidation } = run([item({ quantity: 1 })])
    expect(cartValidation.valid).toBe(true)
  })
})

describe('過期訂單', () => {
  it('過了今天最後營業時間（19:00），歸還日還是今天 → 要重選日期', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 17, 20, 0))
    const today = item({ startDate: '2026-11-17', endDate: '2026-11-17' })
    expect(run([today]).expiredOrdersValidation.expiredKeys).toEqual(['2026-11-17_2026-11-17'])
    expect(run([item({ startDate: '2026-11-17', endDate: '2026-11-18' })]).expiredOrdersValidation.valid).toBe(true)
    vi.useRealTimers()
  })

  it('起租日早於今日 → 列入 expiredKeys', () => {
    const expired = item({ startDate: '2020-01-01', endDate: '2020-01-03' })
    const { expiredOrdersValidation } = run([expired])
    expect(expiredOrdersValidation.valid).toBe(false)
    expect(expiredOrdersValidation.expiredKeys).toEqual(['2020-01-01_2020-01-03'])
  })

  it('未來日期 → 有效', () => {
    const { expiredOrdersValidation } = run([item()])
    expect(expiredOrdersValidation.valid).toBe(true)
  })
})

describe('設備缺貨', () => {
  it('數量超過庫存 → 列入缺貨清單', () => {
    const { stockAvailabilityValidation } = run([item({ quantity: 3 })], {}, { tripod: 2 })
    expect(stockAvailabilityValidation.valid).toBe(false)
    expect(stockAvailabilityValidation.outOfStockItems).toContain('腳架')
  })

  it('同設備多時段合計超過庫存 → 缺貨', () => {
    const a = item({ quantity: 2 })
    const b = item({ quantity: 2, startDate: '2099-02-01', endDate: '2099-02-03' })
    const { stockAvailabilityValidation } = run([a, b], {}, { tripod: 3 })
    expect(stockAvailabilityValidation.valid).toBe(false)
  })

  it('別人先送出（含待繳押金）佔掉的量要扣 → 購物車超過剩餘量即缺貨', () => {
    const cart = [item({ quantity: 3 })]
    const { stockAvailabilityValidation } = renderHook(() =>
      useCartValidation({
        cart,
        bookingDetails: {},
        getOriginalQuantity: () => 5,
        getCartQuantity: () => 3,
        getReserved: () => 3
      })
    ).result.current
    expect(stockAvailabilityValidation.valid).toBe(false)
  })

  it('空間被別人先借走 → 列入清單、擋送出；過期時段先改日期，不判', () => {
    const block = (over: Partial<CartItem> = {}) => item({ id: 'A1', name: '區塊 A1', category: 'space-block', ...over })
    const check = (cart: CartItem[]) => renderHook(() =>
      useCartValidation({ cart, bookingDetails: {}, getOriginalQuantity: () => 0, getCartQuantity: () => 0, isTaken: i => i.id === 'A1' })
    ).result.current.stockAvailabilityValidation
    expect(check([block()]).outOfStockItems).toEqual(['區塊 A1'])
    expect(check([block({ id: 'A2', name: '區塊 A2' })]).valid).toBe(true)
    expect(check([block({ startDate: '2020-01-01', endDate: '2020-01-03' })]).valid).toBe(true)
  })
})

describe('借用資訊', () => {
  it('缺任一時段的借用資訊 → 無效', () => {
    const { bookingDetailsValidation } = run([item()])
    expect(bookingDetailsValidation.valid).toBe(false)
  })

  it('所有訂單都有填 → 有效', () => {
    const { bookingDetailsValidation } = run([item()], {
      'equipment_2099-01-01_2099-01-03': { reason: '課堂作業' }
    })
    expect(bookingDetailsValidation.valid).toBe(true)
  })

  it('同時段設備與空間分單，各自要填', () => {
    const space = item({ id: 'A1', name: '區塊 A1', category: 'space-block' })
    const { bookingDetailsValidation } = run([item(), space], {
      'equipment_2099-01-01_2099-01-03': { reason: '課堂作業' }
    })
    expect(bookingDetailsValidation.valid).toBe(false)
  })
})

describe('同類別一次一張訂單（舊購物車）', () => {
  it('同類別兩個時段 → 無效；設備＋空間各一 → 有效', () => {
    const twoEquip = run([item(), item({ id: 'light', startDate: '2099-02-01', endDate: '2099-02-03' })])
    expect(twoEquip.singleOrderValidation.valid).toBe(false)
    expect(twoEquip.singleOrderValidation.message).toContain('設備')
    const equipAndSpace = run([item(), item({ id: 'A1', category: 'space-block', startDate: '2099-02-01', endDate: '2099-02-03' })])
    expect(equipAndSpace.singleOrderValidation.valid).toBe(true)
  })
})
