/**
 * 送單流程：
 * - 將購物車依「設備／空間 × 時段」分組（一組＝一張訂單，cartGroupKey），呼叫 Supabase RPC submit_orders
 *   （訂單＋品項＋通知包在同一個 transaction，要嘛全成立要嘛全不算）
 * - 失敗時回傳原因，購物車保留，由呼叫端提示重送
 * - 成功後仍寫一份 localStorage receipts：orderValidation 的重複下單檢查
 *   尚依賴它（roadmap 階段 3 搬 server 端後移除）
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { cartGroupKey } from '../types/equipment'
import type { CartItem, Receipt } from '../types/equipment'
import type { Student } from '../utils/authTypes'
import { receiptsKey } from '../utils/storageKeys'

const DEPOSIT_CAP_PER_CATEGORY = 5000

interface UseOrderSubmissionArgs {
  cart: CartItem[]
  currentUser: Student | null
  clearCart: () => void
  // 借用資訊，依 cartGroupKey 為 key（與下方分組相同）
  bookingDetails?: Record<string, {
    reason?: string; className?: string; teacher?: string
    depositDate?: string; depositSlot?: string; pickupSlot?: string // 大量設備預選時段
  }>
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

/**
 * 送單錯誤 → 給學生看的原因。submit_orders 的 raise exception（P0001）本身就是中文說明
 * （庫存不足、空間已被預約、封鎖期、停權、欠罰款…），直接顯示；其餘依常見情況翻成白話。
 */
export const submitErrorMessage = (error: { code?: string; message?: string } | null): string => {
  const msg = error?.message ?? ''
  if (error?.code === 'P0001' && msg) return msg
  if (error?.code === '23505') return '同一時間有其他人送單，訂單編號衝突，請再按一次送出'
  if (msg.includes('JWT')) return '登入已過期，請重新登入後再送出（購物車會保留）'
  if (msg.includes('fetch')) return '網路連線失敗，請檢查網路後再送出'
  return `送出失敗（${msg || '未知錯誤'}），請再試一次`
}

export const useOrderSubmission = ({ cart, currentUser, clearCart, bookingDetails = {} }: UseOrderSubmissionArgs) => {
  const navigate = useNavigate()

  return useCallback(async (): Promise<SubmitResult> => {
    if (cart.length === 0) return { ok: false, reason: '購物車是空的' }

    // 按「設備／空間 × 時段」分組（一組＝一張訂單；同時段設備與空間各自成單）
    const dateGroups: Record<string, CartItem[]> = {}
    cart.forEach(item => {
      const key = cartGroupKey(item)
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
        deposit_date: details?.depositDate ?? null,
        deposit_slot: details?.depositSlot ?? null,
        pickup_slot: details?.pickupSlot ?? null,
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
      return { ok: false, reason: submitErrorMessage(error) }
    }

    // ---- localStorage receipts 同步（僅供 orderValidation 重複下單檢查，階段 3 移除） ----
    const receiptsStorageKey = receiptsKey(currentUser?.studentId)
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
    // ---- receipts 同步結束 ----

    // 通知已由 submit_orders 在資料庫端寫入，這裡只通知 Header 重新讀取
    window.dispatchEvent(new Event('notificationUpdated'))

    clearCart()
    navigate('/profile')
    return { ok: true }
  }, [cart, currentUser, clearCart, navigate, bookingDetails])
}
