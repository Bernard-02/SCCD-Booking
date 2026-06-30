import type { Receipt, BookingType } from '../types/equipment'
import { receiptsKey } from './storageKeys'

export const checkDuplicateOrder = (
  studentId: string | undefined,
  startDate: Date | null,
  endDate: Date | null,
  bookingType: BookingType
): { isDuplicate: boolean; message: string } => {
  if (!startDate || !endDate) return { isDuplicate: false, message: '' }

  const receipts: Receipt[] = JSON.parse(localStorage.getItem(receiptsKey(studentId)) || '[]')

  const targetStart = new Date(startDate).getTime()
  const targetEnd = new Date(endDate).getTime()

  for (const receipt of receipts) {
    if (receipt.items && receipt.items.length > 0) {
      // 假設一張訂單只有一個時段（目前系統邏輯）
      const firstItem = receipt.items[0]
      const existingStart = new Date(firstItem.startDate).getTime()
      const existingEnd = new Date(firstItem.endDate).getTime()

      // 檢查時間關係
      // 完全重疊：時間完全相同
      const isFullyOverlapping = existingStart === targetStart && existingEnd === targetEnd

      const receiptType = firstItem.bookingType || 'little'

      // 重複下單規則：
      // 1. 時間完全重疊：小量-小量不允許（限制1單），其他組合允許無限單
      // 2. 時間部分重疊：所有組合都允許（1單以上）
      // 3. 時間錯開：所有組合都允許（1單以上）

      if (isFullyOverlapping) {
        // 只有小量-小量的完全重疊不允許
        if (bookingType === 'little' && receiptType === 'little') {
          return { isDuplicate: true, message: '此時段已有一張小量訂單，不可重複租借。' }
        }
        // 其他情況（小量-大量、大量-小量、大量-大量）都允許
      }
      // 部分重疊或完全錯開的情況都允許，不需要額外檢查
    }
  }

  return { isDuplicate: false, message: '' }
}