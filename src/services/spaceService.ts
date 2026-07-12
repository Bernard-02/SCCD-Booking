/**
 * 空間資料來源：Supabase public.space_blocks + 佔用查詢
 * 取代 SpaceAreaMap 裡寫死的 mockAreaBlocksData。
 * 區塊定義（id→區域/押金）模組層快取；佔用狀態依所選時段即時查詢。
 */

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface SpaceBlock {
  area: string   // square / corridor / front-terrace / back-terrace / glass-wall / pillar / classroom
  deposit: number
  name: string | null
}

export type SpaceBlocksMap = Record<string, SpaceBlock>

let cache: SpaceBlocksMap | null = null
let inflight: Promise<SpaceBlocksMap> | null = null

export const loadSpaceBlocks = (): Promise<SpaceBlocksMap> => {
  if (cache) return Promise.resolve(cache)
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('space_blocks')
        .select('id, area, deposit, name')
        .eq('is_active', true)
      if (error) throw error
      cache = Object.fromEntries(
        (data as { id: string; area: string; deposit: number; name: string | null }[]).map(row => [
          row.id,
          { area: row.area, deposit: row.deposit, name: row.name }
        ])
      )
      return cache
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/** 取得空間區塊定義（載入完成前為空物件） */
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

/** 查詢指定時段被佔用的空間 id（區塊＋教室）。日期格式 YYYY-MM-DD */
export async function fetchOccupiedSpaces(startDate: string, endDate: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('space_occupied', {
    p_start: startDate,
    p_end: endDate
  })
  if (error) throw error
  return (data as { item_id: string }[]).map(row => row.item_id)
}
