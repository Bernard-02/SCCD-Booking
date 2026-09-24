/**
 * 送單流程：
 * - 將購物車依時段分組，呼叫 Supabase RPC submit_orders
 *   （訂單＋品項＋通知包在同一個 transaction，要嘛全成立要嘛全不算）
 * - 失敗時回傳 RPC 的拒絕原因（庫存不足、已被預約、停權等），購物車保留，由呼叫端提示重送
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import type { CartItem } from '../types/equipment'

interface UseOrderSubmissionArgs {
  cart: CartItem[]
  clearCart: () => void
  // 借用資訊，依 `${startDate}_${endDate}` 為 key（與下方分組相同）
  bookingDetails?: Record<string, { reason?: string; className?: string; teacher?: string }>
}

export interface SubmitResult {
  ok: boolean
  reason?: string
}

/** 'YYYY-MM-DD' 或 ISO 字串 → 'YYYY-MM-DD'（RPC 的 date 參數用） */
const toDateOnly = (s: string): string => {
  const d = new Date(s)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const useOrderSubmission = ({ cart, clearCart, bookingDetails = {} }: UseOrderSubmissionArgs) => {
  const navigate = useNavigate()

  return useCallback(async (): Promise<SubmitResult> => {
    if (cart.length === 0) return { ok: false, reason: '購物車是空的' }

    // 按時段分組（一組＝一張訂單）
    const dateGroups: Record<string, CartItem[]> = {}
    cart.forEach(item => {
      const key = `${item.startDate}_${item.endDate}`
      if (!dateGroups[key]) dateGroups[key] = []
      dateGroups[key].push(item)
    })

    // 組 RPC payload
    const payload = Object.entries(dateGroups).map(([dateKey, items]) => {
      const details = bookingDetails[dateKey]
      return {
        start_date: toDateOnly(items[0].startDate),
        end_date: toDateOnly(items[0].endDate),
        booking_type: items[0].bookingType || 'little',
        reason: details?.reason ?? null,
        class_name: details?.className ?? null,
        teacher: details?.teacher ?? null,
        items: items.map(item => ({
          item_type: item.category === 'equipment' ? 'equipment' : item.category, // space-block / classroom 原樣
          item_id: item.id,
          name: item.name,
          quantity: item.quantity,
          deposit: item.deposit
        }))
      }
    })

    // 送出（transaction：全部成立或全部不算）
    // 規則違反時 RPC 以 raise exception 回傳中文原因（error.message），直接顯示給學生
    const { data: rentalNumbers, error } = await supabase.rpc('submit_orders', { p_orders: payload })
    if (error || !rentalNumbers) {
      console.error('送單失敗:', error)
      return { ok: false, reason: error?.message || '送出失敗，請再試一次' }
    }

    // 通知已由 submit_orders 在資料庫端寫入，這裡只通知 Header 重新讀取
    window.dispatchEvent(new Event('notificationUpdated'))

    clearCart()
    navigate('/profile')
    return { ok: true }
  }, [cart, clearCart, navigate, bookingDetails])
}
