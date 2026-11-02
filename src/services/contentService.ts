/**
 * 後台可改的文字（site_content 表）：讀全表快取在模組裡，前台各處用 useSiteContent() 取值；
 * 表沒建（SQL 未執行）或讀取失敗就全用 src/data/siteContent.ts 的內建文字。
 */

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { resolveContent, type Bilingual } from '../data/siteContent'

type Rows = Record<string, Bilingual>
let cache: Rows | null = null
let inflight: Promise<Rows> | null = null
const listeners = new Set<(rows: Rows) => void>()

const toRows = (data: { key: string; zh: string | null; en: string | null }[] | null): Rows =>
  Object.fromEntries((data ?? []).map(r => [r.key, { zh: r.zh ?? '', en: r.en ?? '' }]))

export async function fetchSiteContent(): Promise<Rows> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = (async () => {
    const { data, error } = await supabase.from('site_content').select('key, zh, en')
    cache = error ? {} : toRows(data)
    inflight = null
    listeners.forEach(fn => fn(cache!))
    return cache
  })()
  return inflight
}

/** 後台用：讀取失敗要知道原因（通常是 SQL 還沒執行） */
export async function listSiteContent(): Promise<Rows> {
  const { data, error } = await supabase.from('site_content').select('key, zh, en')
  if (error) throw error
  cache = toRows(data)
  return cache
}

export async function saveSiteContent(key: string, zh: string, en: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('site_content').upsert({ key, zh, en, updated_at: new Date().toISOString() })
  if (error) return { ok: false, message: error.message }
  cache = { ...(cache ?? {}), [key]: { zh, en } }
  listeners.forEach(fn => fn(cache!))
  return { ok: true }
}

/** 前台：get(key) → { zh, en }（內建文字先頂著，表讀回來再換） */
export function useSiteContent() {
  const [rows, setRows] = useState<Rows | null>(cache)
  useEffect(() => {
    listeners.add(setRows)
    if (!cache) fetchSiteContent()
    return () => { listeners.delete(setRows) }
  }, [])
  return useCallback((key: string) => resolveContent(key, rows?.[key]), [rows])
}
