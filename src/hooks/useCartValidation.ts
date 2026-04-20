/**
 * 購物車結帳前的驗證規則
 * - 大量租借須滿 10 件
 * - 訂單日期不能過期
 * - 設備不能缺貨
 * - 所有時段都要填借用資訊
 */

import { useMemo } from 'react'
import type { CartItem } from '../types/equipment'

interface BookingDetailsData {
  reason: string
  className?: string
  teacher?: string
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
}

interface UseCartValidationResult {
  cartValidation: BaseResult
  expiredOrdersValidation: ExpiredResult
  stockAvailabilityValidation: StockResult
  bookingDetailsValidation: BaseResult
}

const groupByDateKey = (cart: CartItem[]): Record<string, CartItem[]> => {
  const groups: Record<string, CartItem[]> = {}
  cart.forEach(item => {
    const key = `${item.startDate}_${item.endDate}`
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })
  return groups
}

export const useCartValidation = ({
  cart,
  bookingDetails,
  getOriginalQuantity,
  getCartQuantity
}: UseCartValidationArgs): UseCartValidationResult => {
  return useMemo(() => {
    // 大量租借（Mass）需至少 10 件
    const cartValidation: BaseResult = (() => {
      const groups = groupByDateKey(cart)
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
              message: '大量租借需滿 10 件項目',
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
      cart.forEach(item => {
        if (item.category !== 'equipment') return
        const totalStock = getOriginalQuantity(item.id)
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
      const groups = groupByDateKey(cart)
      const missing: string[] = []
      for (const [key, items] of Object.entries(groups)) {
        if (items.length === 0) continue
        if (!bookingDetails[key]) {
          missing.push(`${items[0].startDate} - ${items[0].endDate}`)
        }
      }
      if (missing.length > 0) {
        return {
          valid: false,
          message: '請完成所有時段的借用資訊填寫',
          detail: 'Please complete booking details for all periods'
        }
      }
      return { valid: true, message: '', detail: '' }
    })()

    return {
      cartValidation,
      expiredOrdersValidation,
      stockAvailabilityValidation,
      bookingDetailsValidation
    }
  }, [cart, bookingDetails, getOriginalQuantity, getCartQuantity])
}
