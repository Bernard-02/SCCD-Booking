/**
 * 購物車純工具函式與常量（無狀態、可測試）
 */

import type { CartItem } from '../../types/equipment'

/** 購物車 localStorage key（連字號，非底線） */
export const CART_STORAGE_KEY = 'sccd-rental-cart'

/** 讀取購物車（無資料回傳空陣列） */
export const readCart = (): CartItem[] =>
  JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]') as CartItem[]

/** 寫入購物車並廣播 storage 事件（跨頁/跨分頁同步） */
export const writeCart = (items: CartItem[]): void => {
  const json = JSON.stringify(items)
  localStorage.setItem(CART_STORAGE_KEY, json)
  window.dispatchEvent(new StorageEvent('storage', { key: CART_STORAGE_KEY, newValue: json }))
}

/** Date → 'YYYY/MM/DD'（補零） */
export const formatYmd = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}

/** Date → 'YYYY-MM-DD'（補零，用作日期 key） */
export const toDateKey = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const AREA_NAME_MAP: Record<string, string> = {
  'square': '中庭',
  'corridor': '專案許可區',
  'front-terrace': '前陽台',
  'back-terrace': '後陽台',
  'glass-wall': '玻璃牆',
  'pillar': '柱子'
}

export const AREA_IMAGE_MAP: Record<string, string> = {
  'square': '/Images/Square.webp',
  'corridor': '/Images/Corridor.webp',
  'front-terrace': '/Images/Front Terrace.webp',
  'back-terrace': '/Images/Back Terrace.webp',
  'glass-wall': '/Images/Glass Wall.webp',
  'pillar': '/Images/Pillar.webp'
}

const FALLBACK_BLOCK_IMAGE = '/Images/Glass Wall.webp'

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
