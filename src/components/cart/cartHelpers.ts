/**
 * 購物車純工具函式與常量（無狀態、可測試）
 */

import type { CartItem } from '../../types/equipment'
import { getCurrentStudentId } from '../../utils/authStorage'

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

/** 寫入購物車並廣播 storage 事件（跨頁/跨分頁同步）；訪客不寫（加入清單本來就擋） */
export const writeCart = (items: CartItem[]): void => {
  const key = cartKey()
  if (!key) return
  const json = JSON.stringify(items)
  localStorage.setItem(key, json)
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: json }))
}

/** Date → 'YYYY/MM/DD'（補零） */
export const formatYmd = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}

/** Date → 'YYYY-MM-DD'（同 timeUtils） */
export { toDateKey } from '../../utils/timeUtils'

export const AREA_NAME_MAP: Record<string, string> = {
  'square': '中庭',
  'corridor': '專案許可區',
  'front-terrace': '前陽台',
  'back-terrace': '後陽台',
  'glass-wall': '玻璃牆',
  'pillar': '柱子'
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
 * 規則：A-E=中庭（沒有 F 區）、G/H/J=專案許可區、K=前陽台、L=後陽台、
 *       Y=玻璃牆（Y4-Y7 例外屬專案許可區）、Z=柱子、A5xx=教室
 */
const PREFIX_AREA_MAP: Record<string, string> = {
  A: 'square', B: 'square', C: 'square', D: 'square', E: 'square',
  G: 'corridor', H: 'corridor', J: 'corridor',
  K: 'front-terrace', L: 'back-terrace', Y: 'glass-wall', Z: 'pillar'
}

export const getBlockArea = (blockId: string): string => {
  if (/^A5\d{2}$/.test(blockId)) return 'classroom'
  if (/^Y[4-7]$/.test(blockId)) return 'corridor'
  return PREFIX_AREA_MAP[blockId[0]] || 'unknown'
}

/** 取得區塊所屬區域的中文名稱 */
export const getAreaName = (blockId: string): string => {
  return AREA_NAME_MAP[getBlockArea(blockId)] || ''
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
