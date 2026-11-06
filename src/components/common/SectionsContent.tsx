/**
 * 段落型說明頁（InfoDialog 的使用教學／系學會分頁）：依 site_sections 的順序渲染——
 * 左欄標題（自動編號「一、二、…」，sticky）、右欄依序排該段的積木：段落／編號條列／項目＋說明／連結／聯絡方式。
 * 內容裡的 {hours} 換成後台排的值班時段。段落與文字後台「文字內容」頁可改，內建預設在 data/siteSections.ts。
 */

import React from 'react'
import Collapse from './Collapse'
import ContactList from './ContactList'
import { contactsFrom, websiteContactFrom } from '../../data/contactInfo'
import { zipLines, splitTitled } from '../../data/siteContent'
import { cnNum, HOURS_TOKEN, type Block, type SectionPage } from '../../data/siteSections'
import { useT } from '../../stores/langStore'
import { useDutyHours } from '../../services/ordersService'
import { useSiteContent, useSiteSections } from '../../services/contentService'

// 區塊：桌機左欄標題（灰）、右欄內容，標題在該段範圍內 sticky（top-16＝InfoDialog 標題高度）；手機內容太長，改成點標題展開
export const Section: React.FC<{ en: string; zh: string; defaultOpen?: boolean; children: React.ReactNode }> = ({ en, zh, defaultOpen = false, children }) => {
  const t = useT()
  const [open, setOpen] = React.useState(defaultOpen)
  return (
    <section className="grid grid-cols-[140px_1fr] gap-6 max-md:block max-md:border-b max-md:border-gray-mid">
      <h3 className="sticky top-16 self-start text-xs text-gray-light max-md:hidden">{t(en, zh)}</h3>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="md:hidden w-full min-h-11 py-2 flex items-center justify-between gap-3 text-left text-xs text-white cursor-pointer"
      >
        {t(en, zh)}
        <span className={`material-symbols-outlined flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      <Collapse open={open} below="md"><div className="max-md:pb-4">{children}</div></Collapse>
    </section>
  )
}

// 數字條列；有 desc 時第二行灰字說明
export const NumberedList: React.FC<{ items: { en: string; zh: string; descEn?: string; descZh?: string }[] }> = ({ items }) => {
  const t = useT()
  return (
    <ol className={items.some(r => r.descZh) ? 'space-y-3' : 'space-y-1'}>
      {items.map((r, i) => (
        <li key={i} className="flex gap-2 text-xs text-white leading-normal">
          <span className="flex-shrink-0 min-w-4 font-english">{i + 1}.</span>
          <div>
            <p>{t(r.en, r.zh)}</p>
            {r.descZh && <p className="text-gray-light leading-relaxed mt-1">{t(r.descEn ?? r.descZh, r.descZh)}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

const SectionsContent: React.FC<{ page: SectionPage }> = ({ page }) => {
  const t = useT()
  const c = useSiteContent()
  const sections = useSiteSections(page)
  const hours = useDutyHours() // undefined＝載入中、null＝尚未排班
  const hoursText = hours
    ? hours
    : { en: hours === null ? 'hours not announced yet (see Facebook)' : '…', zh: hours === null ? '時段尚未公布（請見 Facebook）' : '…' }
  const fill = (s: string, lang: 'zh' | 'en') => s.split(HOURS_TOKEN).join(hoursText[lang])

  const block = (b: Block) => {
    const body = { zh: fill(b.zh, 'zh'), en: fill(b.en, 'en') }
    switch (b.kind) {
      case 'text':
        return (
          <div className="space-y-3">
            {zipLines(body).map((p, i) => <p key={i} className="text-xs text-white leading-relaxed">{t(p.en, p.zh)}</p>)}
          </div>
        )
      case 'list': return <NumberedList items={zipLines(body)} />
      case 'titled': return <NumberedList items={zipLines(body).map(splitTitled)} />
      case 'link':
        return (
          <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-xs text-white underline underline-offset-4 hover:opacity-50 self-start">
            {t(body.en, body.zh)}
          </a>
        )
      case 'contact': return <ContactList contacts={[...contactsFrom(c), websiteContactFrom(c)]} />
    }
  }

  return (
    <div className="space-y-10 max-md:space-y-0">
      {sections.map((s, i) => (
        <Section key={i} en={s.titleEn} zh={`${cnNum(i + 1)}、${s.titleZh}`} defaultOpen={i === 0}>
          <div className="flex flex-col gap-4">
            {s.blocks.map((b, j) => <React.Fragment key={j}>{block(b)}</React.Fragment>)}
          </div>
        </Section>
      ))}
    </div>
  )
}

export default SectionsContent
