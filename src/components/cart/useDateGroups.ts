/**
 * 將購物車依「起迄日期 + 類別（equipment／space）」分組後排序
 * 空間組優先於設備組，日期較早優先
 */

import { useMemo } from 'react'
import type { CartItem } from '../../types/equipment'

export interface DateGroup {
  startDate: string
  endDate: string
  category: 'equipment' | 'space'
  items: CartItem[]
}

export const useDateGroups = (cart: CartItem[]): DateGroup[] => {
  return useMemo(() => {
    const dateMap: Record<string, { equipment: CartItem[]; space: CartItem[] }> = {}

    cart.forEach(item => {
      const key = `${item.startDate}_${item.endDate}`
      if (!dateMap[key]) {
        dateMap[key] = { equipment: [], space: [] }
      }

      if (item.category === 'equipment') {
        dateMap[key].equipment.push(item)
      } else {
        dateMap[key].space.push(item)
      }
    })

    const groups: DateGroup[] = []
    Object.entries(dateMap).forEach(([key, items]) => {
      const [startDate, endDate] = key.split('_')

      if (items.space.length > 0) {
        groups.push({ startDate, endDate, category: 'space', items: items.space })
      }
      if (items.equipment.length > 0) {
        groups.push({ startDate, endDate, category: 'equipment', items: items.equipment })
      }
    })

    // 日期較早優先；同日期時空間優先於設備
    return groups.sort((a, b) => {
      const dateCompare = new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      if (dateCompare !== 0) return dateCompare
      return a.category === 'space' ? -1 : 1
    })
  }, [cart])
}
