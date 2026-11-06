/**
 * 後台 · 文字內容 → 段落型頁（使用教學／系學會）編輯器（2026-11-03 改版，像資料庫）：
 * 第一層是段落清單（一列一段）：拖曳把手排序、點一列在右側滑入面板編輯；面板裡是中英標題＋積木
 * （段落／編號條列／項目＋說明／連結／聯絡方式），積木也可拖曳排序、刪除、底下加新的。
 * 整頁一顆「儲存」（save_site_sections 一次寫入）。表裡沒有列時以內建段落帶入；全部刪光儲存＝回內建。
 * 拖曳用瀏覽器原生 HTML5 DnD（把手 draggable、整列是放下目標），不加套件；鍵盤替代排在 roadmap 階段 5.5。
 */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BLOCK_KINDS, DEFAULT_SECTIONS, blankBlock, blankSection, type Block, type BlockKind, type SectionPage, type SiteSection } from '../../data/siteSections'
import { listSiteSections, saveSiteSections } from '../../services/contentService'
import { LoadError, actionBtn, inputCls, textBtn } from './adminUi'
import CloseButton from '../common/CloseButton'
import { BTN } from '../common/btn'
import type { useToast } from '../../hooks/useToast'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const kindOf = (k: BlockKind) => BLOCK_KINDS.find(b => b.id === k)!
const icon = (name: string, size = 18) => <span className="material-symbols-outlined" style={{ fontSize: `${size}px` }} aria-hidden="true">{name}</span>
const iconBtn = `w-7 h-7 inline-flex items-center justify-center rounded-lg text-white ${BTN}`

/** 原生拖曳排序：handle(i) 給把手、target(i) 給整列（放下目標）、cls(i) 給拖曳中／落點的樣式 */
function useDragList(move: (from: number, to: number) => void) {
  const [from, setFrom] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const reset = () => { setFrom(null); setOver(null) }
  const handle = (i: number) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { setFrom(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)) },
    onDragEnd: reset
  })
  const target = (i: number) => ({
    onDragOver: (e: React.DragEvent) => { if (from === null) return; e.preventDefault(); if (over !== i) setOver(i) },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); if (from !== null && from !== i) move(from, i); reset() }
  })
  const cls = (i: number) =>
    from === i ? 'opacity-50' : from !== null && over === i ? (from > i ? 'border-t-2 !border-t-white' : 'border-b-2 !border-b-white') : ''
  return { handle, target, cls }
}

const reorder = <T,>(list: T[], from: number, to: number): T[] => {
  const n = [...list]
  const [x] = n.splice(from, 1)
  n.splice(to, 0, x)
  return n
}

const SectionsEditor: React.FC<{ page: SectionPage; showToast: ReturnType<typeof useToast>['showToast'] }> = ({ page, showToast }) => {
  const [saved, setSaved] = useState<SiteSection[] | null>(null)
  const [draft, setDraft] = useState<SiteSection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<number | null>(null) // 右側面板正在編輯的段落

  const load = async () => {
    setError(null)
    setSaved(null)
    try {
      const rows = await listSiteSections()
      const s = rows[page] ?? DEFAULT_SECTIONS[page]
      setSaved(s)
      setDraft(s)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => { load() }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  // Esc 關面板
  useEffect(() => {
    if (editing === null) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditing(null) }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [editing])

  const patchSection = (i: number, patch: Partial<SiteSection>) => setDraft(d => d.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const patchBlock = (i: number, j: number, patch: Partial<Block>) =>
    patchSection(i, { blocks: draft[i].blocks.map((b, k) => (k === j ? { ...b, ...patch } : b)) })
  const addSection = () => { setDraft(d => [...d, blankSection()]); setEditing(draft.length) }
  const removeSection = (i: number) => { setDraft(d => d.filter((_, j) => j !== i)); setEditing(null) }
  const sectionDrag = useDragList((from, to) => { setDraft(d => reorder(d, from, to)); setEditing(null) })
  const blockDrag = useDragList((from, to) => { if (editing !== null) patchSection(editing, { blocks: reorder(draft[editing].blocks, from, to) }) })

  const dirty = !!saved && !same(draft, saved)
  const save = async () => {
    setBusy(true)
    const res = await saveSiteSections(page, draft)
    setBusy(false)
    if (!res.ok) { showToast(res.message ?? '儲存失敗'); return }
    setSaved(draft)
    showToast('已儲存', 'success')
  }

  if (error) {
    return <LoadError message={error.includes('site_sections') ? `${error}（supabase/site-sections.sql 還沒執行？）` : error} onRetry={load} />
  }
  if (!saved) return <p className="py-16 text-center text-xs text-gray-light">載入中…</p>

  const summary = (s: SiteSection) => s.blocks.length ? s.blocks.map(b => kindOf(b.kind).label).join('、') : '（沒有積木）'
  const cur = editing !== null ? draft[editing] : null

  return (
    <div className="max-w-5xl">
      {/* 工具列 */}
      <div className="flex items-center gap-4 mb-4">
        <button type="button" onClick={addSection} className={textBtn(false)}>{icon('add')}新增段落</button>
        <button
          type="button"
          onClick={() => { setDraft(DEFAULT_SECTIONS[page]); setEditing(null) }}
          disabled={same(draft, DEFAULT_SECTIONS[page])}
          className={`ml-auto text-xs text-gray-light ${BTN}`}
        >
          還原內建段落
        </button>
        <button type="button" onClick={save} disabled={!dirty || busy} className={actionBtn}>
          {busy ? '儲存中…' : '儲存'}
        </button>
      </div>

      {/* 段落清單：把手拖曳排序、點一列開面板 */}
      <div className="border-t border-gray-mid">
        {draft.map((s, i) => (
          <div key={i} {...sectionDrag.target(i)} className={`flex items-center gap-3 h-12 border-b border-gray-mid ${sectionDrag.cls(i)}`}>
            <span {...sectionDrag.handle(i)} className="material-symbols-outlined text-gray-light cursor-grab active:cursor-grabbing select-none" style={{ fontSize: '20px' }} aria-label="拖曳排序">drag_indicator</span>
            <span className="w-5 font-english text-xs text-gray-light">{i + 1}.</span>
            <button
              type="button"
              onClick={() => setEditing(i)}
              className={`flex-1 min-w-0 h-full flex items-center gap-4 px-2 rounded-lg text-left cursor-pointer ${editing === i ? 'bg-white/10' : 'hover:bg-white/10'}`}
            >
              <span className="text-xs text-white whitespace-nowrap">{s.titleZh || '（未命名）'}</span>
              <span className="text-xs text-gray-light truncate font-english">{s.titleEn}</span>
              <span className="ml-auto text-2xs text-gray-light whitespace-nowrap">{summary(s)}</span>
            </button>
            <button type="button" onClick={() => removeSection(i)} className={iconBtn} aria-label="刪除段落" title="刪除段落">{icon('delete')}</button>
          </div>
        ))}
        {draft.length === 0 && <p className="py-10 text-center text-xs text-gray-light">沒有段落，按「新增段落」開始；直接儲存＝回內建。</p>}
      </div>

      {/* 右側滑入面板：標題＋積木 */}
      {cur && editing !== null && createPortal(
        <aside
          role="dialog"
          aria-label="編輯段落"
          className="fixed inset-y-0 right-0 z-[9999] w-[640px] max-w-full bg-gray-darker border-l border-gray-mid flex flex-col font-chinese"
          style={{ animation: 'slideInRight 0.2s ease-out' }}
        >
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-mid">
            <h2 className="text-sm text-white">第 <span className="font-english">{editing + 1}</span> 段</h2>
            <CloseButton onClick={() => setEditing(null)} />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 flex flex-col gap-6">
            {/* 標題：顯示時自動加編號，這裡不用填「一、」 */}
            <div className="grid grid-cols-2 gap-4">
              <input value={cur.titleZh} onChange={e => patchSection(editing, { titleZh: e.target.value })} placeholder="標題（中文）" className={`${inputCls} font-chinese`} />
              <input value={cur.titleEn} onChange={e => patchSection(editing, { titleEn: e.target.value })} placeholder="Title (English)" className={`${inputCls} font-english`} />
            </div>

            {/* 積木 */}
            <div className="flex flex-col gap-3">
              {cur.blocks.map((b, j) => {
                const k = kindOf(b.kind)
                return (
                  <div key={j} {...blockDrag.target(j)} className={`border border-gray-mid rounded-2xl p-4 flex flex-col gap-3 ${blockDrag.cls(j)}`}>
                    <div className="flex items-center gap-2">
                      <span {...blockDrag.handle(j)} className="material-symbols-outlined text-gray-light cursor-grab active:cursor-grabbing select-none" style={{ fontSize: '20px' }} aria-label="拖曳排序">drag_indicator</span>
                      {icon(k.icon)}
                      <span className="text-xs text-white">{k.label}</span>
                      <span className="text-2xs text-gray-light">{k.hint}</span>
                      <button type="button" onClick={() => patchSection(editing, { blocks: cur.blocks.filter((_, x) => x !== j) })} className={`ml-auto ${iconBtn}`} aria-label="刪除積木" title="刪除積木">{icon('delete')}</button>
                    </div>
                    {b.kind !== 'contact' && (
                      <div className="grid grid-cols-2 gap-4">
                        <textarea
                          value={b.zh}
                          onChange={e => patchBlock(editing, j, { zh: e.target.value })}
                          rows={b.kind === 'link' ? 1 : 5}
                          spellCheck={false}
                          placeholder={b.kind === 'link' ? '連結文字（中文）' : '中文'}
                          className={`${inputCls} w-full resize-y leading-relaxed font-chinese`}
                        />
                        <textarea
                          value={b.en}
                          onChange={e => patchBlock(editing, j, { en: e.target.value })}
                          rows={b.kind === 'link' ? 1 : 5}
                          spellCheck={false}
                          placeholder={b.kind === 'link' ? 'Link text (English)' : 'English'}
                          className={`${inputCls} w-full resize-y leading-relaxed font-english`}
                        />
                      </div>
                    )}
                    {b.kind === 'link' && (
                      <input value={b.url} onChange={e => patchBlock(editing, j, { url: e.target.value })} placeholder="https://…" className={`${inputCls} font-english`} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* 加積木：點種類直接加到最後 */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-light mr-1">加入積木</span>
              {BLOCK_KINDS.map(k => (
                <button key={k.id} type="button" onClick={() => patchSection(editing, { blocks: [...cur.blocks, blankBlock(k.id)] })} className={textBtn(false)}>
                  {icon(k.icon)}{k.label}
                </button>
              ))}
            </div>
          </div>
        </aside>,
        document.body
      )}
    </div>
  )
}

export default SectionsEditor
