/**
 * 設備資料來源：Supabase public.equipment
 * 取代舊的靜態 src/data/equipment-data.json。
 * 模組層快取：整個 SPA 生命週期只抓一次，所有 hook 共用同一份。
 */

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Equipment, EquipmentData } from '../types/equipment'

interface EquipmentRow {
  id: string
  name: string
  en_name: string | null
  category: string
  sub_category: string | null
  location: string | null
  original_quantity: number
  stock_quantity: number
  deposit: number
  image_url: string | null
}

// DB row → 前端 Equipment；可預約池以「在庫」為準（線下借出不在架上）
const mapRow = (row: EquipmentRow): Equipment => ({
  id: row.id,
  category: row.category,
  name: row.name,
  status: '',
  mainImage: row.image_url || 'Images/Extension Cord.webp',
  originalQuantity: row.stock_quantity,
  availableQuantity: row.stock_quantity,
  deposit: row.deposit,
  description: ''
})

let cache: EquipmentData | null = null
let inflight: Promise<EquipmentData> | null = null

export const loadEquipmentData = (): Promise<EquipmentData> => {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('equipment')
        .select('*')
        .eq('is_active', true)
        .order('id')
      if (error) throw error
      cache = Object.fromEntries((data as EquipmentRow[]).map(row => [row.id, mapRow(row)]))
      return cache
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/** 取得設備資料（載入完成前為空物件，庫存判斷會暫時視為 0） */
export const useEquipmentData = (): EquipmentData => {
  const [data, setData] = useState<EquipmentData>(cache ?? {})

  useEffect(() => {
    if (cache) return
    let mounted = true
    loadEquipmentData()
      .then(d => { if (mounted) setData(d) })
      .catch(err => console.error('載入設備資料失敗:', err))
    return () => { mounted = false }
  }, [])

  return data
}
