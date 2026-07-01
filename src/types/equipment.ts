/**
 * 設備數據類型定義
 */

export interface Equipment {
  id: string
  category: string
  name: string
  status: string
  mainImage: string
  originalQuantity: number
  availableQuantity: number
  deposit: number
  description: string
}

export type EquipmentData = Record<string, Equipment>

/**
 * 租借類型
 */
export type BookingType = 'little' | 'mass-personal' | 'mass-group'

/**
 * 購物車項目類型
 */
export interface CartItem {
  id: string
  name: string
  category: string
  deposit: number
  image: string
  quantity: number
  startDate: string // ISO 格式的開始日期
  endDate: string   // ISO 格式的結束日期
  bookingType?: BookingType // 租借類型
}

/**
 * 儲存於 localStorage 的訂單收據
 */
export interface Receipt {
  borrowerName: string
  rentalDates: string[]
  rentalNumber: string
  totalDeposit: number
  items: CartItem[]
  createdAt: string
  reason?: string // 借用使用原因（填寫借用資訊時取得）
}
