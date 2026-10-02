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
 * 設備分類（固定清單，zh 即 equipment.category 存的值）：
 * 前台設備頁篩選與後台設備管理下拉共用——改分類只改這裡（資料庫既有值要同步）
 */
export const EQUIPMENT_CATEGORIES = [
  { en: 'Cables', zh: '線材', icon: 'cable' },
  { en: 'Power Cords', zh: '電源線', icon: 'electrical_services' },
  { en: 'Audio/Video', zh: '視聽', icon: 'videocam' },
  { en: 'Lighting', zh: '燈具', icon: 'lightbulb' },
  { en: 'Displays/Tables', zh: '展版/展桌/展台', icon: 'table_restaurant' },
  { en: 'Tools', zh: '工具', icon: 'handyman' },
  { en: 'Machinery', zh: '機具', icon: 'precision_manufacturing' }
]

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
 * 購物車組別 key＝一張訂單：設備／空間 × 起訖日。
 * 設備與空間分單（2026-09-29 新規則 4）：同時段的設備與空間各自成單，
 * 借用資訊、9 件／押金上限、類型互斥、送單分組都以此為單位。
 */
export const cartGroupKey = (item: Pick<CartItem, 'category' | 'startDate' | 'endDate'>) =>
  `${item.category === 'equipment' ? 'equipment' : 'space'}_${item.startDate}_${item.endDate}`

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
