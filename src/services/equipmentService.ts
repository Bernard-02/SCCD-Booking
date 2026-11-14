/**
 * 設備資料來源：Supabase public.equipment
 * 取代舊的靜態 src/data/equipment-data.json。
 * 模組層快取：整個 SPA 生命週期只抓一次，所有 hook 共用同一份。
 */

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { CartItem, Equipment, EquipmentData } from '../types/equipment'
import { shiftPairBundles, type Bundle } from '../utils/bundleUtils'
import { useT } from '../stores/langStore'
import { AREA_IMAGE_MAP, FALLBACK_BLOCK_IMAGE, reservedFor } from '../components/cart/cartHelpers'

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

/** 圖片路徑補前導斜線：seed 存相對路徑 'Images/…'，在 /admin/* 等子路由底下會解析錯；未上傳圖片用預設圖 */
export const imageSrc = (url: string | null | undefined, fallback = '/Images/Extension Cord.webp'): string => {
  if (!url) return fallback
  return url.startsWith('/') || url.startsWith('http') ? url : `/${url}`
}

/**
 * 設備＋教室＋編號區格子的最新圖片（id → src），**不分開放／下架**：購物車快照、Profile／訂單頁的舊單一律顯示後台目前的圖。
 * 模組層快取（同其他前台資料：後台換圖後學生重整生效）；讀取失敗回空表、不快取，各處退回原本的圖。
 * 沒上傳過的：教室＝/Images/{id}.webp、編號區格子＝該區示意圖（AREA_IMAGE_MAP）。
 */
let imagesPromise: Promise<Record<string, string>> | null = null
export const loadItemImages = (): Promise<Record<string, string>> => {
  if (!imagesPromise) {
    imagesPromise = Promise.all([
      supabase.from('equipment').select('id, image_url'),
      supabase.from('space').select('id, area, image_url')
    ]).then(([e, s]) => {
      if (e.error || s.error) throw e.error ?? s.error
      return Object.fromEntries([
        ...(e.data ?? []).map(r => [r.id, imageSrc(r.image_url)]),
        ...(s.data ?? []).map(r => [
          r.id,
          imageSrc(r.image_url, r.area === 'classroom' ? `/Images/${r.id}.webp` : AREA_IMAGE_MAP[r.area] ?? FALLBACK_BLOCK_IMAGE)
        ])
      ])
    }).catch(err => {
      console.error('載入圖片失敗:', err)
      imagesPromise = null
      return {}
    })
  }
  return imagesPromise
}

/** loadItemImages 的 hook 版（載入完成前為空物件） */
export const useItemImages = (): Record<string, string> => {
  const [images, setImages] = useState<Record<string, string>>({})
  useEffect(() => {
    let mounted = true
    void loadItemImages().then(m => { if (mounted) setImages(m) })
    return () => { mounted = false }
  }, [])
  return images
}

/**
 * 設備、組合、教室的英文名稱（後台可改，supabase/item-en-names.sql）：id → en_name，不分上下架，舊單也查得到。
 * 訂單與購物車存的是中文名快照，所以顯示時用 id 查，改名後全站跟著變。模組層快取同圖片。
 */
let namesPromise: Promise<Record<string, string>> | null = null
const loadItemNames = () => (namesPromise ??= Promise.all([
  supabase.from('equipment').select('id, en_name'),
  supabase.from('equipment_bundles').select('id, en_name'),
  supabase.from('space').select('id, en_name')
]).then(([e, b, s]) => Object.fromEntries(
  [...(e.data ?? []), ...(b.data ?? []), ...(s.data ?? [])].filter(r => r.en_name).map(r => [r.id, r.en_name as string])
)))

/** 依目前語言顯示品項名稱：EN 模式用英文名，沒填退回中文（EN 模式看到中文＝提醒要補） */
export const useItemName = (): ((id: string, zh: string) => string) => {
  const t = useT()
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => {
    let mounted = true
    void loadItemNames().then(m => { if (mounted) setNames(m) })
    return () => { mounted = false }
  }, [])
  return (id, zh) => t(names[id] || zh, zh)
}

/**
 * 設備組合（後台「設備管理 › 組合」，supabase/equipment-bundles.sql），依建立順序（＝湊組優先序）。
 * 模組層快取同圖片；讀取失敗（例：SQL 尚未執行）回空陣列＝沒有組合，照單件計。
 * 後面接上分時段設備（雷切機午班＋晚班）內建的組合（bundleUtils.shiftPairBundles；設備不分上下架，舊單也湊得起來），
 * 後台已經有剛好同一對的組合就不重複加。
 */
let bundlesPromise: Promise<Bundle[]> | null = null
export const loadBundles = (): Promise<Bundle[]> => {
  if (!bundlesPromise) {
    bundlesPromise = Promise.all([
      supabase
        .from('equipment_bundles')
        .select('id, name, deposit, equipment_bundle_items(equipment_id, quantity)')
        .order('created_at'),
      supabase.from('equipment').select('id, name, deposit')
    ]).then(([{ data, error }, equipment]) => {
      if (error) throw error
      const bundles: Bundle[] = (data ?? []).map(b => ({
        id: b.id,
        name: b.name,
        deposit: b.deposit,
        items: (b.equipment_bundle_items ?? []).map(i => ({ equipmentId: i.equipment_id, quantity: i.quantity }))
      }))
      const samePair = (a: Bundle, b: Bundle) =>
        a.items.length === 2 && a.items.every(c => c.quantity === 1 && b.items.some(p => p.equipmentId === c.equipmentId))
      return [...bundles, ...shiftPairBundles(equipment.data ?? []).filter(p => !bundles.some(b => samePair(b, p)))]
    }).catch(err => {
      console.error('載入設備組合失敗:', err)
      bundlesPromise = null
      return []
    })
  }
  return bundlesPromise
}

/** loadBundles 的 hook 版（載入完成前為空陣列） */
export const useBundles = (): Bundle[] => {
  const [bundles, setBundles] = useState<Bundle[]>([])
  useEffect(() => {
    let mounted = true
    void loadBundles().then(b => { if (mounted) setBundles(b) })
    return () => { mounted = false }
  }, [])
  return bundles
}

// DB row → 前端 Equipment；可預約池以「在庫」為準（線下借出不在架上）
const mapRow = (row: EquipmentRow): Equipment => ({
  id: row.id,
  category: row.category,
  location: row.location ?? '',
  name: row.name,
  status: '',
  mainImage: imageSrc(row.image_url),
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

export interface ReservedInfo {
  reserved: number // 該時段被生效訂單（pending/in-progress/overdue）佔用的數量
  onHold: number   // 其中押金還沒繳的部分（待繳押金的單＋小量取件後新增未點交；已繳待取件不算）
}

/** 查詢指定時段各設備的佔用量（RPC，只回統計不含個資）。日期格式 YYYY-MM-DD */
export async function fetchEquipmentReserved(
  startDate: string,
  endDate: string
): Promise<Record<string, ReservedInfo>> {
  const { data, error } = await supabase.rpc('equipment_reserved', {
    p_start: startDate,
    p_end: endDate
  })
  if (error) throw error
  return Object.fromEntries(
    (data as { item_id: string; reserved: number; on_hold: number }[]).map(row => [
      row.item_id,
      { reserved: Number(row.reserved), onHold: Number(row.on_hold) }
    ])
  )
}

/**
 * 購物車設備在各自時段已被生效訂單佔用的量（含待繳押金 On Hold）。
 * 先送先贏：購物車不佔庫存，別人先送出，我車裡超過剩餘量的就要調整（同購物平台）。切回分頁、或 tick 變了（清單頁每分鐘＋送單被擋之後）重抓。
 */
export const useCartReserved = (cart: CartItem[], tick = 0): ((item: CartItem) => number) => {
  const periods = [...new Set(cart.filter(i => i.category === 'equipment').map(i => `${i.startDate}_${i.endDate}`))]
    .sort().join('|')
  // 分時段的設備（有 days）只佔借的那幾天，要另外抓逐日佔用才知道那幾天有沒有被借走
  const hasDays = cart.some(i => i.days)
  const [map, setMap] = useState<Record<string, { range: Record<string, ReservedInfo>; daily: Record<string, Record<string, number>> | null }>>({})

  useEffect(() => {
    if (!periods) { setMap({}); return }
    let alive = true
    const load = () => {
      Promise.all(periods.split('|').map(async p => {
        const [s, e] = p.split('_')
        const [range, daily] = await Promise.all([
          fetchEquipmentReserved(s, e),
          hasDays ? fetchEquipmentReservedDaily(s, e).catch(() => null) : null
        ])
        return [p, { range, daily }] as const
      }))
        .then(entries => { if (alive) setMap(Object.fromEntries(entries)) })
        .catch(err => console.error('讀取設備佔用失敗:', err))
    }
    load()
    window.addEventListener('focus', load)
    return () => { alive = false; window.removeEventListener('focus', load) }
  }, [periods, tick, hasDays])

  return useCallback(
    (item: CartItem) => {
      const m = map[`${item.startDate}_${item.endDate}`]
      return reservedFor(item, m?.range, m?.daily)
    },
    [map]
  )
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

/**
 * 該時段各設備「逐日」佔用量（部分時段可借用；supabase/partial-availability.sql）：item_id → { 'YYYY-MM-DD': 佔用件數 }。
 * RPC 還沒執行時會 throw，呼叫端退回整段判定（equipment_reserved）。
 */
export async function fetchEquipmentReservedDaily(
  startDate: string,
  endDate: string
): Promise<Record<string, Record<string, number>>> {
  const { data, error } = await supabase.rpc('equipment_reserved_daily', { p_start: startDate, p_end: endDate })
  if (error) throw error
  const out: Record<string, Record<string, number>> = {}
  for (const row of data as { item_id: string; day: string; reserved: number }[]) {
    ;(out[row.item_id] ??= {})[row.day] = Number(row.reserved)
  }
  return out
}
