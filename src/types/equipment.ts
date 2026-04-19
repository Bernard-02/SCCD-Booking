/**
 * 設備數據類型定義
 */

export interface Equipment {
  id: string
  category: string
  name: string
  status: string
  statusColor: string
  mainImage: string
  originalQuantity: number
  availableQuantity: number
  deposit: number
  description: string
}

export type EquipmentData = Record<string, Equipment>

export type EquipmentCategory = '全部' | '燈具' | '線材' | '攝影設備' | '展桌/畫板' | '其他'

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
