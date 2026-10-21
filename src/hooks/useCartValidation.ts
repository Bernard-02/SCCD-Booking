/**
 * 購物車結帳前的驗證規則
 * - 大量租借須滿 10 件
 * - 訂單日期不能過期
 * - 設備不能缺貨
 * - 所有時段都要填借用資訊
 */

import { useMemo } from 'react'
import { cartGroupKey } from '../types/equipment'
import { slotEnd } from '../utils/timeUtils'
import type { CartItem } from '../types/equipment'

interface BookingDetailsData {
  reason: string
  className?: string
  teacher?: string
  depositDate?: string
  depositSlot?: string
  pickupSlot?: string
}

interface BaseResult {
  valid: boolean
  message: string
  detail: string
}

interface ExpiredResult extends BaseResult {
  expiredKeys: string[]
}

interface StockResult extends BaseResult {
  outOfStockItems: string[]
}

interface UseCartValidationArgs {
  cart: CartItem[]
  bookingDetails: Record<string, BookingDetailsData>
  getOriginalQuantity: (id: string) => number
  getCartQuantity: (id: string) => number
  /** 該品項時段已被他人訂單佔用的量（含 On Hold）；未給視為 0 */
  getReserved?: (item: CartItem) => number
}

interface UseCartValidationResult {
  cartValidation: BaseResult
  expiredOrdersValidation: ExpiredResult
  stockAvailabilityValidation: StockResult
  bookingDetailsValidation: BaseResult
  singleOrderValidation: BaseResult
}

// 過期以時段為單位（CartList／RentalListPage 用 `${start}_${end}` 比對）；
// 大量 10 件、借用資訊以訂單為單位（cartGroupKey：設備／空間分單）
const groupBy = (cart: CartItem[], keyOf: (item: CartItem) => string): Record<string, CartItem[]> => {
  const groups: Record<string, CartItem[]> = {}
  cart.forEach(item => {
    const key = keyOf(item)
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })
  return groups
}
const groupByDateKey = (cart: CartItem[]) => groupBy(cart, item => `${item.startDate}_${item.endDate}`)
const groupByOrder = (cart: CartItem[]) => groupBy(cart, cartGroupKey)

export const useCartValidation = ({
  cart,
  bookingDetails,
  getOriginalQuantity,
  getCartQuantity,
  getReserved = () => 0
}: UseCartValidationArgs): UseCartValidationResult => {
  return useMemo(() => {
    // 大量租借（Mass）需至少 10 件
    const cartValidation: BaseResult = (() => {
      const groups = groupByOrder(cart)
      for (const items of Object.values(groups)) {
        if (items.length === 0) continue
        const bookingType = items[0].bookingType || 'little'
        if (bookingType === 'mass-personal' || bookingType === 'mass-group') {
          const totalQuantity = items.reduce((sum, item) => {
            return sum + (item.category === 'equipment' ? item.quantity : 1)
          }, 0)
          if (totalQuantity < 10) {
            return {
              valid: false,
              message: '大量／團體訂單需各滿 10 件項目',
              detail: 'Mass booking requires min. 10 items'
            }
          }
        }
      }
      return { valid: true, message: '', detail: '' }
    })()

    // 過期訂單（開始日期早於今日）
    const expiredOrdersValidation: ExpiredResult = (() => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const expiredKeys: string[] = []
      const groups = groupByDateKey(cart)

      for (const [key, items] of Object.entries(groups)) {
        if (items.length === 0) continue
        const startDate = new Date(items[0].startDate)
        startDate.setHours(0, 0, 0, 0)
        if (startDate < today) {
          expiredKeys.push(key)
        }
      }

      if (expiredKeys.length > 0) {
        return {
          valid: false,
          message: '部分訂單日期已過期，請點擊 Edit 編輯日期',
          detail: 'Some orders have expired dates, please click Edit to update',
          expiredKeys
        }
      }

      return { valid: true, message: '', detail: '', expiredKeys: [] }
    })()

    // 設備缺貨檢查
    const stockAvailabilityValidation: StockResult = (() => {
      const outOfStockItems: string[] = []
      const todayMs = new Date().setHours(0, 0, 0, 0)
      cart.forEach(item => {
        if (item.category !== 'equipment') return
        // 過期時段由「日期已過期」擋；改日期後才依新時段判斷庫存
        if (new Date(item.startDate).setHours(0, 0, 0, 0) < todayMs) return
        const totalStock = getOriginalQuantity(item.id) - getReserved(item)
        const otherItemsQty = getCartQuantity(item.id) - item.quantity
        const maxQtyForThisItem = totalStock - otherItemsQty
        if (item.quantity > maxQtyForThisItem) {
          outOfStockItems.push(item.name)
        }
      })

      if (outOfStockItems.length > 0) {
        return {
          valid: false,
          message: '部分設備缺貨，請調整數量或移除',
          detail: 'Some equipment is out of stock, please adjust quantity or remove',
          outOfStockItems
        }
      }

      return { valid: true, message: '', detail: '', outOfStockItems: [] }
    })()

    // 借用資訊填寫檢查
    const bookingDetailsValidation: BaseResult = (() => {
      const groups = groupByOrder(cart)
      const missing: string[] = []
      for (const [key, items] of Object.entries(groups)) {
        if (items.length === 0) continue
        const d = bookingDetails[key]
        // 大量設備單另需繳押金／取件時段，且繳押金時段不能已經過了（填完隔幾天才送單的情況）
        const needsSlots = key.startsWith('equipment_') && items[0].bookingType === 'mass-personal'
        const slotsOk = !needsSlots || (
          !!d?.pickupSlot && !!d.depositDate && !!d.depositSlot && slotEnd(d.depositDate, d.depositSlot) > new Date()
        )
        if (!d || !slotsOk) {
          missing.push(`${items[0].startDate} - ${items[0].endDate}`)
        }
      }
      if (missing.length > 0) {
        return {
          valid: false,
          message: '請完成所有訂單的借用資訊填寫（大量設備需選繳押金與取件時段，已過的時段請重選）',
          detail: 'Please complete booking details for all orders'
        }
      }
      return { valid: true, message: '', detail: '' }
    })()

    // 同類別一次一張訂單（新規則 7）：加入時已擋，這裡攔規則上線前就存在的舊購物車
    const singleOrderValidation: BaseResult = (() => {
      const orders = Object.keys(groupByOrder(cart))
      const over = (['equipment', 'space'] as const).filter(c => orders.filter(k => k.startsWith(`${c}_`)).length > 1)
      if (over.length > 0) {
        return {
          valid: false,
          message: `${over.map(c => (c === 'equipment' ? '設備' : '空間')).join('、')}一次只能有一張訂單，請移除多餘的時段`,
          detail: 'Only one order per category'
        }
      }
      return { valid: true, message: '', detail: '' }
    })()

    return {
      cartValidation,
      expiredOrdersValidation,
      stockAvailabilityValidation,
      bookingDetailsValidation,
      singleOrderValidation
    }
  }, [cart, bookingDetails, getOriginalQuantity, getCartQuantity, getReserved])
}
