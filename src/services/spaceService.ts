/**
 * 空間資料來源：Supabase public.space（編號區塊＋教室）+ 佔用查詢
 * 取代 SpaceAreaMap 裡寫死的 mockAreaBlocksData。
 * 區塊定義（id→區域/押金）模組層快取；佔用狀態依所選時段即時查詢。
 */

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface SpaceBlock {
  area: string   // square / corridor / front-terrace / back-terrace / glass-wall / pillar / classroom
  deposit: number
  name: string | null
  en_name?: string | null   // 教室英文名稱（後台可改，supabase/item-en-names.sql）
  image_url?: string | null // 教室圖（後台上傳；null＝沿用 /Images/{id}.webp）
}

export type SpaceBlocksMap = Record<string, SpaceBlock>

let cache: SpaceBlocksMap | null = null
// 後台關閉（is_active=false）的空間 id：前台可檢視、不能選（地圖畫停用色）
let closedIds: ReadonlySet<string> = new Set()
let inflight: Promise<SpaceBlocksMap> | null = null

export const loadSpaceBlocks = (): Promise<SpaceBlocksMap> => {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight

  inflight = (async () => {
    try {
      // select('*')：image_url 欄位的 SQL（space-edit-images.sql）尚未執行時也不會壞
      // 全部撈（space 為 public read），開放的進 cache、關閉的另存 closedIds
      const { data, error } = await supabase
        .from('space')
        .select('*')
      if (error) throw error
      const rows = data as (SpaceBlock & { id: string; is_active: boolean })[]
      cache = Object.fromEntries(
        rows.filter(row => row.is_active).map(row => [
          row.id,
          { area: row.area, deposit: row.deposit, name: row.name, en_name: row.en_name, image_url: row.image_url }
        ])
      )
      closedIds = new Set(rows.filter(row => !row.is_active).map(row => row.id))
      return cache
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/** 取得空間區塊定義：只含開放中的（is_active=true；載入完成前為空物件） */
export const useSpaceBlocks = (): SpaceBlocksMap => {
  const [data, setData] = useState<SpaceBlocksMap>(cache ?? {})

  useEffect(() => {
    if (cache) return
    let mounted = true
    loadSpaceBlocks()
      .then(d => { if (mounted) setData(d) })
      .catch(err => console.error('載入空間區塊失敗:', err))
    return () => { mounted = false }
  }, [])

  return data
}

/** 後台關閉的空間 id（與 useSpaceBlocks 同一次載入，載入完成時一起更新） */
export const useClosedSpaceIds = (): ReadonlySet<string> => {
  useSpaceBlocks()
  return closedIds
}

/** 查詢指定時段被佔用的空間 id（區塊＋教室）。日期格式 YYYY-MM-DD */
export async function fetchOccupiedSpaces(startDate: string, endDate: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('space_occupied', {
    p_start: startDate,
    p_end: endDate
  })
  if (error) throw error
  return (data as { item_id: string }[]).map(row => row.item_id)
}

/** 該時段各空間被佔用的「日子」（部分時段可借用；supabase/partial-availability.sql）：id → Set<'YYYY-MM-DD'>。RPC 沒執行時 throw */
export async function fetchOccupiedSpacesDaily(startDate: string, endDate: string): Promise<Record<string, Set<string>>> {
  const { data, error } = await supabase.rpc('space_occupied_daily', { p_start: startDate, p_end: endDate })
  if (error) throw error
  const out: Record<string, Set<string>> = {}
  for (const row of data as { item_id: string; day: string }[]) (out[row.item_id] ??= new Set()).add(row.day)
  return out
}
