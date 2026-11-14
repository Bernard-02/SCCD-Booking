/**
 * 購物車結帳前的驗證規則
 * - 大量租借須滿 10 件
 * - 訂單日期不能過期
 * - 設備不能缺貨、空間不能已被別人借走
 * - 所有時段都要填借用資訊
 */

import { useMemo } from 'react'
import { cartGroupKey } from '../types/equipment'
import { periodExpired, slotEnd } from '../utils/timeUtils'
import type { CartItem } from '../types/equipment'
import { calcBundles, type Bundle } from '../utils/bundleUtils'
import type { BookingDetailsData } from '../components/common/BookingDetailsDialog'

const NO_BUNDLES: Bundle[] = []

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
  /** 空間（格子／教室）這個時段已被別人的訂單借走；未給視為都沒有 */
  isTaken?: (item: CartItem) => boolean
  /** 設備組合（湊滿一組算 1 件）；未給＝照單件計 */
  bundles?: Bundle[]
}

interface UseCartValidationResult {
  cartValidation: BaseResult
  expiredOrdersValidation: ExpiredResult
  stockAvailabilityValidation: StockResult
  bookingDetailsValidation: BaseResult
  singleOrderValidation: BaseResult
  littleLimitValidation: BaseResult
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
  getReserved = () => 0,
  isTaken = () => false,
  bundles = NO_BUNDLES
}: UseCartValidationArgs): UseCartValidationResult => {
  return useMemo(() => {
    const equipmentUnits = (items: CartItem[]) => calcBundles(items, bundles).units

    // 大量租借（Mass）需至少 10 件
    const cartValidation: BaseResult = (() => {
      const groups = groupByOrder(cart)
      for (const items of Object.values(groups)) {
        if (items.length === 0) continue
        const bookingType = items[0].bookingType || 'little'
        if (bookingType === 'mass-personal' || bookingType === 'mass-group') {
          const totalQuantity = items[0].category === 'equipment' ? equipmentUnits(items) : items.length
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

    // 過期訂單：開始日期早於今日，或歸還日已經還不了（過了今天最後營業時間，歸還日還是今天；timeUtils.periodExpired）
    const expiredOrdersValidation: ExpiredResult = (() => {
      const expiredKeys: string[] = []
      const groups = groupByDateKey(cart)

      for (const [key, items] of Object.entries(groups)) {
        if (items.length === 0) continue
        if (periodExpired(items[0].startDate, items[0].endDate)) {
          expiredKeys.push(key)
        }
      }

      if (expiredKeys.length > 0) {
        return {
          valid: false,
          message: '部分訂單日期已過期，請點鉛筆修改日期',
          detail: 'Some orders have expired dates, tap the pencil to update',
          expiredKeys
        }
      }

      return { valid: true, message: '', detail: '', expiredKeys: [] }
    })()

    // 被別人先借走（先送先贏，購物車不佔位）：設備缺貨、空間已被預約
    const stockAvailabilityValidation: StockResult = (() => {
      const outOfStockItems: string[] = []
      const todayMs = new Date().setHours(0, 0, 0, 0)
      cart.forEach(item => {
        // 過期時段由「日期已過期」擋；改日期後才依新時段判斷庫存
        if (new Date(item.startDate).setHours(0, 0, 0, 0) < todayMs) return
        if (item.category !== 'equipment') {
          if (isTaken(item)) outOfStockItems.push(item.name)
          return
        }
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
          message: '清單裡有東西已被借走，請調整數量或移除',
          detail: 'Some items in your list have been taken. Please adjust the quantity or remove them',
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

    // 小量設備 9 件：加入時已擋，但減少數量可能拆散組合讓件數變多（整組算 1 件），送單前再攔一次
    const littleLimitValidation: BaseResult = (() => {
      const over = Object.values(groupByOrder(cart)).some(items =>
        items[0].category === 'equipment' && (items[0].bookingType || 'little') === 'little' && equipmentUnits(items) > 9
      )
      return over
        ? { valid: false, message: '小量設備最多 9 件（整組算 1 件），請調整數量', detail: 'Light booking allows up to 9 items (a full set counts as 1)' }
        : { valid: true, message: '', detail: '' }
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
      singleOrderValidation,
      littleLimitValidation
    }
  }, [cart, bookingDetails, getOriginalQuantity, getCartQuantity, getReserved, isTaken, bundles])
}
