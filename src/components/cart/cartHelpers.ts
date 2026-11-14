/**
 * 購物車純工具函式與常量（無狀態、可測試）
 */

import type { CartItem } from '../../types/equipment'
import type { BookingDetailsData } from '../common/BookingDetailsDialog'
import { getCurrentStudentId } from '../../utils/authStorage'
import { SHIFT_RE } from '../../utils/bundleUtils'
import { shiftPassed } from '../../utils/timeUtils'

/** 購物車 localStorage key 前綴（連字號，非底線） */
export const CART_STORAGE_KEY = 'sccd-rental-cart'

/** 購物車依學號分開存（sccd-rental-cart_{學號}），換人登入各看各的；訪客（未登入）沒有購物車＝null */
export const cartKey = (): string | null => {
  const id = getCurrentStudentId()
  return id ? `${CART_STORAGE_KEY}_${id}` : null
}

/** 讀取購物車（無資料或訪客回傳空陣列） */
export const readCart = (): CartItem[] => {
  const key = cartKey()
  return key ? JSON.parse(localStorage.getItem(key) || '[]') as CartItem[] : []
}

/** 寫入並廣播 storage 事件（同頁各元件重讀；services/cartService 據此推上帳號）；訪客不寫（加入清單本來就擋） */
const put = (key: string | null, value: unknown): void => {
  if (!key) return
  const json = JSON.stringify(value)
  localStorage.setItem(key, json)
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: json }))
}

export const writeCart = (items: CartItem[]): void => put(cartKey(), items)

/** 各單借用資訊（cartGroupKey → BookingDetailsData），同購物車依學號分開存：sccd_booking_details_{學號} */
export const detailsKey = (): string | null => {
  const id = getCurrentStudentId()
  return id ? `sccd_booking_details_${id}` : null
}

export const readDetails = (): Record<string, BookingDetailsData> => {
  const key = detailsKey()
  return key ? JSON.parse(localStorage.getItem(key) || '{}') : {}
}

export const writeDetails = (details: Record<string, BookingDetailsData>): void => put(detailsKey(), details)

/** Date → 'YYYY/MM/DD'（補零） */
export const formatYmd = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}

/** Date → 'YYYY-MM-DD'（同 timeUtils） */
export { toDateKey } from '../../utils/timeUtils'

/** space.area → 前台子分類 id（專案許可區含走廊與柱子）；區域名稱用 contentService.useAreaName 讀 */
export const AREA_SUBCATEGORY: Record<string, string> = {
  'square': 'Square',
  'corridor': 'CasePermitArea',
  'front-terrace': 'FrontTerrace',
  'back-terrace': 'BackTerrace',
  'glass-wall': 'GlassWall',
  'pillar': 'CasePermitArea'
}

// 區域示意圖（public/Images 實際有的檔）；前／後陽台沒有圖，退回 FALLBACK_BLOCK_IMAGE（後台清單則顯示 placeholder icon）
export const AREA_IMAGE_MAP: Record<string, string> = {
  'square': '/Images/Square.webp',
  'corridor': '/Images/Corridor.webp',
  'glass-wall': '/Images/Glass Wall.webp',
  'pillar': '/Images/Pillar.webp'
}

export const FALLBACK_BLOCK_IMAGE = '/Images/A5F Numbered Area.webp'

/** 格式化日期為 YYYY/MM/DD */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/**
 * 由格子代號推導所屬區域（純函式，與 SVG 的地理配置綁定）
 * 規則：A-F=中庭、G/H/J=專案許可區、K=前陽台、L=後陽台、
 *       Y=玻璃牆（Y4-Y7 例外屬專案許可區）、Z=柱子、A5xx=教室
 */
const PREFIX_AREA_MAP: Record<string, string> = {
  A: 'square', B: 'square', C: 'square', D: 'square', E: 'square', F: 'square',
  G: 'corridor', H: 'corridor', J: 'corridor',
  K: 'front-terrace', L: 'back-terrace', Y: 'glass-wall', Z: 'pillar'
}

export const getBlockArea = (blockId: string): string => {
  if (/^A5\d{2}$/.test(blockId)) return 'classroom'
  if (/^Y[4-7]$/.test(blockId)) return 'corridor'
  return PREFIX_AREA_MAP[blockId[0]] || 'unknown'
}

/** 取得區塊對應的區域圖片 */
export const getBlockImage = (blockId: string): string => {
  return AREA_IMAGE_MAP[getBlockArea(blockId)] || FALLBACK_BLOCK_IMAGE
}

/** 以「字母前綴 + 數字尾」自然排序（A1 < A2 < A10 < B1） */
export const sortBlockIds = (ids: string[]): string[] => {
  return [...ids].sort((a, b) => {
    const matchA = a.match(/^([A-Z]+)(\d+)$/)
    const matchB = b.match(/^([A-Z]+)(\d+)$/)
    if (!matchA || !matchB) return a.localeCompare(b)
    const [, letterA, numA] = matchA
    const [, letterB, numB] = matchB
    if (letterA !== letterB) return letterA.localeCompare(letterB)
    return parseInt(numA, 10) - parseInt(numB, 10)
  })
}

/**
 * 清單裡這個設備已被別人的訂單佔用幾個。range＝整段佔用（equipment_reserved）、daily＝逐日佔用（equipment_reserved_daily）。
 * 分時段的設備（有 days）只看借的那幾天裡最滿的一天；選的日子超出租借日期（清單改過日期）、或那一班已經過了
 * （加進清單後放到下午才送）＝借不到，回 Infinity，清單照缺貨標出來、鎖住送出，請學生移除後重選。沒有逐日資料（RPC 讀不到）退回整段。
 */
export const reservedFor = (
  item: Pick<CartItem, 'id' | 'name' | 'startDate' | 'endDate' | 'days'>,
  range: Record<string, { reserved: number }> = {},
  daily?: Record<string, Record<string, number>> | null,
  now: Date = new Date()
): number => {
  if (!item.days) return range[item.id]?.reserved ?? 0
  const shift = SHIFT_RE.exec(item.name)?.[1] === '午班' ? 'noon' : 'evening'
  if (item.days.some(d => d < item.startDate || d > item.endDate || shiftPassed(d, shift, now))) return Infinity
  return daily ? Math.max(0, ...item.days.map(d => daily[item.id]?.[d] ?? 0)) : range[item.id]?.reserved ?? 0
}

/** 部分時段可借：購物車裡同一類（設備／空間）的品項全部改成新起訖（同類型限一單，不開第二張） */
export const rescheduleCategory = (cart: CartItem[], category: 'equipment' | 'space', startDate: string, endDate: string): CartItem[] =>
  cart.map(i => ((i.category === 'equipment') === (category === 'equipment') ? { ...i, startDate, endDate } : i))
