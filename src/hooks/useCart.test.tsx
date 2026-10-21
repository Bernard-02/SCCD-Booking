/**
 * useCart 測試：加入購物車的規則把關
 * （9 件上限、押金 5000 cap、租借類型互斥、停權、同品項合併）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCart, LOGIN_REQUIRED_MSG } from './useCart'
import { useSuspension } from './useSuspension'
import type { CartItem } from '../types/equipment'

// 設備資料與停權狀態都走 mock，不打 Supabase
vi.mock('../services/equipmentService', () => ({
  useEquipmentData: () => ({})
}))
vi.mock('./useSuspension', () => ({
  useSuspension: vi.fn(() => false)
}))
const auth = vi.hoisted(() => ({ isAuthenticated: true }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }))

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

beforeEach(() => {
  localStorage.clear()
  vi.mocked(useSuspension).mockReturnValue(false)
  auth.isAuthenticated = true
})

describe('addToCart', () => {
  it('加入成功並寫入購物車', () => {
    const { result } = renderHook(() => useCart())
    act(() => {
      expect(result.current.addToCart(item()).ok).toBe(true)
    })
    expect(result.current.cart).toHaveLength(1)
  })

  it('同品項同時段合併數量', () => {
    const { result } = renderHook(() => useCart())
    act(() => { result.current.addToCart(item({ quantity: 2 })) })
    act(() => { result.current.addToCart(item({ quantity: 3 })) })
    expect(result.current.cart).toHaveLength(1)
    expect(result.current.cart[0].quantity).toBe(5)
  })

  it('小量訂單超過 9 件被擋', () => {
    const { result } = renderHook(() => useCart())
    act(() => { result.current.addToCart(item({ quantity: 9 })) })
    let res: { ok: boolean; reason?: string }
    act(() => { res = result.current.addToCart(item({ id: 'light', name: '燈', quantity: 1 })) })
    expect(res!.ok).toBe(false)
    expect(res!.reason).toContain('9 件')
  })

  it('小量設備押金超過 5000 被擋', () => {
    const { result } = renderHook(() => useCart())
    act(() => { result.current.addToCart(item({ deposit: 3000 })) })
    let res: { ok: boolean; reason?: string }
    act(() => { res = result.current.addToCart(item({ id: 'cam', name: '相機', deposit: 2500 })) })
    expect(res!.ok).toBe(false)
    expect(res!.reason).toContain('上限')
  })

  it('大量-團體不檢查押金上限', () => {
    const { result } = renderHook(() => useCart())
    let res: { ok: boolean; reason?: string }
    act(() => {
      res = result.current.addToCart(item({ bookingType: 'mass-group', deposit: 6000 }))
    })
    expect(res!.ok).toBe(true)
  })

  it('同時段小量與大量-個人互斥', () => {
    const { result } = renderHook(() => useCart())
    act(() => { result.current.addToCart(item()) })
    let res: { ok: boolean; reason?: string }
    act(() => {
      res = result.current.addToCart(
        item({ id: 'cam', name: '相機', bookingType: 'mass-personal' })
      )
    })
    expect(res!.ok).toBe(false)
    expect(res!.reason).toContain('小量')
  })

  it('設備／空間分單：空間不佔 9 件額度、兩類租借類型互不影響', () => {
    const { result } = renderHook(() => useCart())
    act(() => { result.current.addToCart(item({ quantity: 9 })) })
    let res: { ok: boolean; reason?: string }
    act(() => { res = result.current.addToCart(item({ id: 'A1', name: '區塊 A1', category: 'space-block', deposit: 1000 })) })
    expect(res!.ok).toBe(true)
    // 購物車已有個人空間 → 團體空間被擋（空間個人／團體擇一，不分時段）；設備不受影響
    act(() => {
      res = result.current.addToCart(item({
        id: 'A2', name: '區塊 A2', category: 'space-block', bookingType: 'mass-group',
        startDate: '2099-02-01', endDate: '2099-02-03'
      }))
    })
    expect(res!.ok).toBe(false)
    expect(res!.reason).toContain('個人空間')
  })

  it('同類型限一單：同類別第二個時段被擋，另一類別不受影響', () => {
    const { result } = renderHook(() => useCart())
    act(() => { result.current.addToCart(item()) })
    let res: { ok: boolean; reason?: string }
    act(() => { res = result.current.addToCart(item({ id: 'light', name: '燈', startDate: '2099-02-01', endDate: '2099-02-03' })) })
    expect(res!.ok).toBe(false)
    expect(res!.reason).toContain('一次只能有一張訂單')
    act(() => {
      res = result.current.addToCart(item({
        id: 'A1', name: '區塊 A1', category: 'space-block', deposit: 1000, startDate: '2099-02-01', endDate: '2099-02-03'
      }))
    })
    expect(res!.ok).toBe(true)
  })

  it('同類別既有訂單已過期：提示先重選日期', () => {
    const { result } = renderHook(() => useCart())
    act(() => { result.current.addToCart(item({ startDate: '2020-01-01', endDate: '2020-01-03' })) })
    let res: { ok: boolean; reason?: string }
    act(() => { res = result.current.addToCart(item({ id: 'light', name: '燈' })) })
    expect(res!.ok).toBe(false)
    expect(res!.reason).toContain('已過期')
  })

  it('停權帳號被擋且購物車不變', () => {
    vi.mocked(useSuspension).mockReturnValue(true)
    const { result } = renderHook(() => useCart())
    let res: { ok: boolean; reason?: string }
    act(() => { res = result.current.addToCart(item()) })
    expect(res!.ok).toBe(false)
    expect(res!.reason).toContain('停權')
    expect(result.current.cart).toHaveLength(0)
  })

  it('訪客（未登入）被擋且購物車不變', () => {
    auth.isAuthenticated = false
    const { result } = renderHook(() => useCart())
    let res: { ok: boolean; reason?: string }
    act(() => { res = result.current.addToCart(item()) })
    expect(res!.ok).toBe(false)
    expect(res!.reason).toBe(LOGIN_REQUIRED_MSG)
    expect(result.current.cart).toHaveLength(0)
  })
})
