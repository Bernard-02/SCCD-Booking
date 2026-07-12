/**
 * 送單流程：
 * - 將購物車依時段分組，呼叫 Supabase RPC submit_orders
 *   （訂單＋品項＋通知包在同一個 transaction，要嘛全成立要嘛全不算）
 * - 失敗時回傳原因，購物車保留，由呼叫端提示重送
 * - 成功後（過渡期）同步寫一份 localStorage receipts／notifications，
 *   Profile 與 Header 尚未改讀資料庫前先維持既有行為
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import type { CartItem, Receipt } from '../types/equipment'
import type { Student } from '../utils/testAuthData'
import { receiptsKey, notificationsKey } from '../utils/storageKeys'

const DEPOSIT_CAP_PER_CATEGORY = 5000

interface UseOrderSubmissionArgs {
  cart: CartItem[]
  currentUser: Student | null
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

export const useOrderSubmission = ({ cart, currentUser, clearCart, bookingDetails = {} }: UseOrderSubmissionArgs) => {
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
    const { data: rentalNumbers, error } = await supabase.rpc('submit_orders', { p_orders: payload })
    if (error || !rentalNumbers) {
      console.error('送單失敗:', error)
      return { ok: false, reason: '送出失敗，請再試一次' }
    }

    // ---- 以下為過渡期 localStorage 同步（Profile／Header 改讀 DB 後移除） ----
    const receiptsStorageKey = receiptsKey(currentUser?.studentId)
    const notificationsStorageKey = notificationsKey(currentUser?.studentId)
    const existingReceipts: Receipt[] = JSON.parse(localStorage.getItem(receiptsStorageKey) || '[]')

    const newReceipts: Receipt[] = Object.entries(dateGroups).map(([dateKey, items], index) => {
      const equipmentDeposit = Math.min(
        items.filter(i => i.category === 'equipment').reduce((s, i) => s + i.deposit * i.quantity, 0),
        DEPOSIT_CAP_PER_CATEGORY
      )
      const spaceDeposit = Math.min(
        items.filter(i => i.category === 'space-block' || i.category === 'classroom').reduce((s, i) => s + i.deposit, 0),
        DEPOSIT_CAP_PER_CATEGORY
      )
      return {
        borrowerName: currentUser?.name || '訪客',
        rentalDates: [items[0].startDate, items[0].endDate],
        rentalNumber: (rentalNumbers as string[])[index],
        totalDeposit: equipmentDeposit + spaceDeposit,
        items,
        createdAt: new Date().toISOString(),
        reason: bookingDetails[dateKey]?.reason
      }
    })
    localStorage.setItem(receiptsStorageKey, JSON.stringify([...existingReceipts, ...newReceipts]))

    const existingNotifications = JSON.parse(localStorage.getItem(notificationsStorageKey) || '[]')
    const newNotifications = newReceipts.map(receipt => ({
      id: 'notif_' + crypto.randomUUID(),
      type: 'success',
      title: '預約成功',
      message: `訂單 ${receipt.rentalNumber} 已送出，請於 24 小時內繳交押金。`,
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/profile'
    }))
    const updatedNotifications = [...newNotifications, ...existingNotifications]
    localStorage.setItem(notificationsStorageKey, JSON.stringify(updatedNotifications))

    window.dispatchEvent(new Event('notificationUpdated'))
    window.dispatchEvent(new StorageEvent('storage', {
      key: notificationsStorageKey,
      newValue: JSON.stringify(updatedNotifications)
    }))
    // ---- 過渡期同步結束 ----

    clearCart()
    navigate('/profile')
    return { ok: true }
  }, [cart, currentUser, clearCart, navigate, bookingDetails])
}
