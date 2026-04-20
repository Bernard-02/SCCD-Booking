/**
 * 送單流程：
 * - 將購物車依時段分組
 * - 為每個時段產生 receipt（押金上限 5000/組）
 * - 寫入 localStorage 並產生預約成功通知
 * - 清空購物車並導向 /profile
 */

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CartItem, Receipt } from '../types/equipment'
import type { Student } from '../utils/testAuthData'

const DEPOSIT_CAP_PER_CATEGORY = 5000

interface UseOrderSubmissionArgs {
  cart: CartItem[]
  currentUser: Student | null
  clearCart: () => void
}

export const useOrderSubmission = ({ cart, currentUser, clearCart }: UseOrderSubmissionArgs) => {
  const navigate = useNavigate()

  return useCallback(() => {
    if (cart.length === 0) return

    const userKey = currentUser?.studentId || 'guest'
    const receiptsKey = `booking_receipts_${userKey}`
    const notificationsKey = `sccd_notifications_${userKey}`

    // 按時段分組
    const dateGroups: Record<string, CartItem[]> = {}
    cart.forEach(item => {
      const key = `${item.startDate}_${item.endDate}`
      if (!dateGroups[key]) dateGroups[key] = []
      dateGroups[key].push(item)
    })

    const year = new Date().getFullYear()
    const existingReceipts: Receipt[] = JSON.parse(localStorage.getItem(receiptsKey) || '[]')
    const newReceipts: Receipt[] = []

    Object.entries(dateGroups).forEach(([dateKey, items]) => {
      const [startDate, endDate] = dateKey.split('_')

      const equipmentDeposit = Math.min(
        items
          .filter(item => item.category === 'equipment')
          .reduce((sum, item) => sum + item.deposit * item.quantity, 0),
        DEPOSIT_CAP_PER_CATEGORY
      )
      const spaceDeposit = Math.min(
        items
          .filter(item => item.category === 'space-block' || item.category === 'classroom')
          .reduce((sum, item) => sum + item.deposit, 0),
        DEPOSIT_CAP_PER_CATEGORY
      )

      const sequenceNumber = existingReceipts.length + newReceipts.length + 1
      const rentalNumber = `#${year}${String(sequenceNumber).padStart(3, '0')}`

      newReceipts.push({
        borrowerName: currentUser?.name || '訪客',
        rentalDates: [startDate, endDate],
        rentalNumber,
        totalDeposit: equipmentDeposit + spaceDeposit,
        items,
        createdAt: new Date().toISOString()
      })
    })

    // 寫入 receipts
    localStorage.setItem(receiptsKey, JSON.stringify([...existingReceipts, ...newReceipts]))

    // 寫入通知
    const existingNotifications = JSON.parse(localStorage.getItem(notificationsKey) || '[]')
    const newNotifications = newReceipts.map(receipt => ({
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'success',
      title: '預約成功',
      message: `訂單 ${receipt.rentalNumber} 已送出，請於 24 小時內繳交押金。`,
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/profile'
    }))
    const updatedNotifications = [...newNotifications, ...existingNotifications]
    localStorage.setItem(notificationsKey, JSON.stringify(updatedNotifications))

    // 通知 Header 立即更新
    window.dispatchEvent(new Event('notificationUpdated'))
    window.dispatchEvent(new StorageEvent('storage', {
      key: notificationsKey,
      newValue: JSON.stringify(updatedNotifications)
    }))

    clearCart()
    navigate('/profile')
  }, [cart, currentUser, clearCart, navigate])
}
