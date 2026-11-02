/**
 * 後台 · 文字內容——使用教學／系學會／誰做的系統／聯絡方式／延期規則的說明文字（site_content 表，supabase/site-content.sql）。
 * 架構固定、只改文字：每條中文／English 各一欄（網址、信箱只有一欄），條列型一行一項、中英一行對一行。
 * 表裡沒有的或清空的＝顯示程式內建文字（data/siteContent.ts）；英文空白＝EN 模式顯示中文。每條自己的「儲存」，改了才能按。
 */

import React, { useEffect, useState } from 'react'
import { CONTENT, CONTENT_GROUPS, type ContentEntry } from '../data/siteContent'
import { listSiteContent, saveSiteContent } from '../services/contentService'
import { PageTitle, LoadError, inputCls, toolBtn, actionBtn } from '../components/admin/adminUi'
import { BTN } from '../components/common/btn'
import { useToast } from '../hooks/useToast'

type Draft = Record<string, { zh: string; en: string }>

const AdminContentPage: React.FC = () => {
  const { showToast, toastElement } = useToast()
  const [saved, setSaved] = useState<Draft | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [group, setGroup] = useState<ContentEntry['group']>('guide')

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

  const current = CONTENT_GROUPS.find(g => g.id === group)!
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

  return (
    <div className="font-chinese">
      {toastElement}
      <PageTitle zh="文字內容" desc="段落架構固定在程式裡，這裡只改文字。清空＝回到程式內建的文字；英文留空＝EN 模式顯示中文。" />

      {error ? (
        <LoadError message={error.includes('site_content') ? `${error}（supabase/site-content.sql 還沒執行？）` : error} onRetry={load} />
      ) : !saved ? (
        <p className="py-16 text-center text-xs text-gray-light">載入中…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {CONTENT_GROUPS.map(g => (
              <button key={g.id} type="button" onClick={() => setGroup(g.id)} className={`${toolBtn(g.id === group)} px-3`}>
                {g.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-light mb-8">{current.desc}</p>

          <div className="flex flex-col gap-10 max-w-5xl">
            {CONTENT.filter(e => e.group === group).map(e => (
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
        </>
      )}
    </div>
  )
}

export default AdminContentPage
