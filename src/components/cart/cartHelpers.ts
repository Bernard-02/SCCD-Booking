/**
 * 購物車純工具函式與常量（無狀態、可測試）
 */

import { mockAreaBlocksData } from '../space/SpaceAreaMap'

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

/** 取得區塊所屬區域的中文名稱 */
export const getAreaName = (blockId: string): string => {
  const blockData = mockAreaBlocksData[blockId]
  if (!blockData) return ''
  return AREA_NAME_MAP[blockData.area] || ''
}

/** 取得區塊對應的區域圖片 */
export const getBlockImage = (blockId: string): string => {
  const blockData = mockAreaBlocksData[blockId]
  if (!blockData) return FALLBACK_BLOCK_IMAGE
  return AREA_IMAGE_MAP[blockData.area] || FALLBACK_BLOCK_IMAGE
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
