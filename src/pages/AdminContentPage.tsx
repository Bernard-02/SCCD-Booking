/**
 * 後台 · 文字內容——給學生看的說明文字。
 * 段落型頁（使用教學／系學會）：site_sections 表，段落可增刪、改標題與內容、換種類、調順序（SectionsEditor）。
 * 欄位型（聯絡方式／誰做的系統／延期規則）：site_content 表，架構固定只改文字，每條中文／English 各一欄（網址、信箱只有一欄），
 * 條列型一行一項、中英一行對一行；清空＝顯示程式內建文字（data/siteContent.ts）；英文空白＝EN 模式顯示中文。每條自己的「儲存」。
 */

import React, { useEffect, useState } from 'react'
import { CONTENT, CONTENT_GROUPS, type ContentEntry } from '../data/siteContent'
import { SECTION_PAGES, type SectionPage } from '../data/siteSections'
import { listSiteContent, saveSiteContent } from '../services/contentService'
import { PageTitle, LoadError, inputCls, toolBtn, actionBtn } from '../components/admin/adminUi'
import SectionsEditor from '../components/admin/SectionsEditor'
import { BTN } from '../components/common/btn'
import { useToast } from '../hooks/useToast'

type Draft = Record<string, { zh: string; en: string }>
type Tab = SectionPage | ContentEntry['group']
const TABS: { id: Tab; label: string; desc: string }[] = [...SECTION_PAGES, ...CONTENT_GROUPS]
const isSectionPage = (t: Tab): t is SectionPage => SECTION_PAGES.some(p => p.id === t)

const AdminContentPage: React.FC = () => {
  const { showToast, toastElement } = useToast()
  const [saved, setSaved] = useState<Draft | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('guide')

  const load = async () => {
    setError(null)
    try {
      const rows = await listSiteContent()
      // 表裡沒有或空白的 key 以內建文字帶入，讓人從現況改
      const d: Draft = Object.fromEntries(CONTENT.map(e => [e.key, { zh: rows[e.key]?.zh || e.zh, en: rows[e.key]?.en || e.en }]))
      setSaved(d)
      setDraft(d)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  useEffect(() => { load() }, [])

  const set = (key: string, lang: 'zh' | 'en', v: string) => setDraft(d => ({ ...d, [key]: { ...d[key], [lang]: v } }))
  const isDirty = (key: string) => !!saved && (draft[key].zh !== saved[key].zh || draft[key].en !== saved[key].en)

  const save = async (e: ContentEntry) => {
    setBusy(e.key)
    const { zh, en } = draft[e.key]
    const res = await saveSiteContent(e.key, zh, e.single ? '' : en)
    setBusy(null)
    if (!res.ok) { showToast(res.message ?? '儲存失敗'); return }
    setSaved(s => ({ ...s!, [e.key]: { zh, en: e.single ? '' : en } }))
    showToast(`已儲存「${e.label}」`, 'success')
  }

  const current = TABS.find(g => g.id === tab)!
  const textarea = (e: ContentEntry, lang: 'zh' | 'en') => (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-2xs text-gray-light">{lang === 'zh' ? '中文' : 'English'}</span>
      <textarea
        value={draft[e.key][lang]}
        onChange={ev => set(e.key, lang, ev.target.value)}
        rows={e.lines ? 6 : e.single ? 1 : 3}
        spellCheck={false}
        className={`${inputCls} w-full resize-y leading-relaxed ${lang === 'zh' && !e.single ? 'font-chinese' : 'font-english'}`}
      />
    </label>
  )

  // 欄位型分頁（site_content）
  const fields = () => error ? (
    <LoadError message={error.includes('site_content') ? `${error}（supabase/site-content.sql 還沒執行？）` : error} onRetry={load} />
  ) : !saved ? (
    <p className="py-16 text-center text-xs text-gray-light">載入中…</p>
  ) : (
    <div className="flex flex-col gap-10 max-w-5xl">
      {CONTENT.filter(e => e.group === tab).map(e => (
        <section key={e.key} className="flex flex-col gap-3">
          <div>
            <h2 className="text-sm text-white">{e.label}</h2>
            <p className="text-2xs text-gray-light mt-0.5">
              {e.lines ? '一行一項，中英一行對一行。' : ''}{e.hint ?? ''}
            </p>
          </div>
          <div className={`grid gap-4 ${e.single ? 'grid-cols-1 max-w-xl' : 'grid-cols-2'}`}>
            {textarea(e, 'zh')}
            {!e.single && textarea(e, 'en')}
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => save(e)} disabled={!isDirty(e.key) || busy === e.key} className={actionBtn}>
              {busy === e.key ? '儲存中…' : '儲存'}
            </button>
            <button
              type="button"
              onClick={() => setDraft(d => ({ ...d, [e.key]: { zh: e.zh, en: e.en } }))}
              disabled={draft[e.key].zh === e.zh && draft[e.key].en === e.en}
              className={`text-xs text-gray-light ${BTN}`}
            >
              還原內建文字
            </button>
          </div>
        </section>
      ))}
    </div>
  )

  return (
    <div className="font-chinese">
      {toastElement}
      <PageTitle zh="文字內容" desc="使用教學／系學會的段落可增刪、改標題與內容、調順序；其餘架構固定只改文字。清空＝回到程式內建；英文留空＝EN 模式顯示中文。" />

      <div className="flex flex-wrap items-center gap-2 mb-2">
        {TABS.map(g => (
          <button key={g.id} type="button" onClick={() => setTab(g.id)} className={`${toolBtn(g.id === tab)} px-3`}>
            {g.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-light mb-8">{current.desc}</p>

      {isSectionPage(tab) ? <SectionsEditor key={tab} page={tab} showToast={showToast} /> : fields()}
    </div>
  )
}

export default AdminContentPage
