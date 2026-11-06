/**
 * 後台可改的文字（site_content 表）：讀全表快取在模組裡，前台各處用 useSiteContent() 取值；
 * 表沒建（SQL 未執行）或讀取失敗就全用 src/data/siteContent.ts 的內建文字。
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { resolveContent, type Bilingual } from '../data/siteContent'
import { DEFAULT_SECTIONS, resolveSection, type Block, type SectionPage, type SiteSection } from '../data/siteSections'

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

// =============================================================
// 段落型頁（site_sections 表，supabase/site-sections.sql）：整表讀回來依 page 分組；該頁沒有列＝內建段落
// =============================================================

type SectionRow = { page: string; position: number; title_zh: string; title_en: string; blocks: unknown }
type SectionRows = Partial<Record<string, SiteSection[]>>
let secCache: SectionRows | null = null
let secInflight: Promise<SectionRows> | null = null
const secListeners = new Set<(rows: SectionRows) => void>()

// blocks jsonb → Block[]（欄位缺的補空字串；不是陣列就當沒有）
const parseBlocks = (v: unknown): Block[] =>
  Array.isArray(v) ? v.map((b: Partial<Block>) => ({ kind: b.kind as Block['kind'], zh: b.zh ?? '', en: b.en ?? '', url: b.url ?? '' })) : []

const toSections = (data: SectionRow[] | null): SectionRows => {
  const out: SectionRows = {}
  for (const r of [...(data ?? [])].sort((a, b) => a.position - b.position)) {
    ;(out[r.page] ??= []).push({ titleZh: r.title_zh ?? '', titleEn: r.title_en ?? '', blocks: parseBlocks(r.blocks) })
  }
  return out
}
const SECTION_COLS = 'page, position, title_zh, title_en, blocks'

export async function fetchSiteSections(): Promise<SectionRows> {
  if (secCache) return secCache
  if (secInflight) return secInflight
  secInflight = (async () => {
    const { data, error } = await supabase.from('site_sections').select(SECTION_COLS)
    secCache = error ? {} : toSections(data)
    secInflight = null
    secListeners.forEach(fn => fn(secCache!))
    return secCache
  })()
  return secInflight
}

/** 後台用：讀取失敗要知道原因（通常是 SQL 還沒執行） */
export async function listSiteSections(): Promise<SectionRows> {
  const { data, error } = await supabase.from('site_sections').select(SECTION_COLS)
  if (error) throw error
  secCache = toSections(data)
  return secCache
}

/** 整頁一次寫入（順序＝陣列順序） */
export async function saveSiteSections(page: SectionPage, sections: SiteSection[]): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('save_site_sections', {
    p_page: page,
    p_sections: sections.map(s => ({ title_zh: s.titleZh, title_en: s.titleEn, blocks: s.blocks }))
  })
  if (error) return { ok: false, message: error.message }
  secCache = { ...(secCache ?? {}) }
  if (sections.length) secCache[page] = sections
  else delete secCache[page]
  secListeners.forEach(fn => fn(secCache!))
  return { ok: true }
}

/** 前台：該頁的段落（內建先頂著，表讀回來再換；英文空白退回中文） */
export function useSiteSections(page: SectionPage): SiteSection[] {
  const [rows, setRows] = useState<SectionRows | null>(secCache)
  useEffect(() => {
    secListeners.add(setRows)
    if (!secCache) fetchSiteSections()
    return () => { secListeners.delete(setRows) }
  }, [])
  return useMemo(() => (rows?.[page] ?? DEFAULT_SECTIONS[page]).map(resolveSection), [rows, page])
}

/** 清單頁「完整使用說明」連結：使用教學第一個「連結」積木的網址 */
export function useGuideDocUrl(): string {
  return useSiteSections('guide').flatMap(s => s.blocks).find(b => b.kind === 'link')?.url ?? ''
}
