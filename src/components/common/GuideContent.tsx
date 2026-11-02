/**
 * GuideContent 組件
 * 使用教學內容（InfoDialog 的 Guide 分頁）：說明如何使用借用系統。
 * 段落架構固定在這裡；文字從 site_content 讀（後台「文字內容」頁可改，內建預設在 data/siteContent.ts）。
 */

import React from 'react'
import { contactsFrom } from '../../data/contactInfo'
import { zipLines } from '../../data/siteContent'
import ContactList from './ContactList'
import { useT } from '../../stores/langStore'
import { useDutyHours } from '../../services/ordersService'
import { useSiteContent } from '../../services/contentService'

// 區塊：左欄標題（灰）、右欄內容；標題在該段範圍內 sticky（top-16＝InfoDialog 標題高度）。SA 分頁共用
export const Section: React.FC<{ en: string; zh: string; children: React.ReactNode }> = ({ en, zh, children }) => {
  const t = useT()
  return (
    <section className="grid grid-cols-[140px_1fr] gap-6">
      <h3 className="sticky top-16 self-start text-xs text-gray-light">{t(en, zh)}</h3>
      {children}
    </section>
  )
}

// 數字條列（工作時間／注意事項／罰款／押金／預約流程、SA 服務項目共用）；有 desc 時第二行灰字說明
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

const GuideContent: React.FC = () => {
  const t = useT()
  const c = useSiteContent()
  const hours = useDutyHours() // undefined＝載入中、null＝尚未排班
  // 工作時間第一條：模板裡的 {hours} 換成後台排的值班時段
  const hoursText = hours
    ? hours
    : { en: hours === null ? 'hours not announced yet (see Facebook)' : '…', zh: hours === null ? '時段尚未公布（請見 Facebook）' : '…' }
  const tpl = c('guide.hours_offline')
  const offline = { zh: tpl.zh.replace('{hours}', hoursText.zh), en: tpl.en.replace('{hours}', hoursText.en) }
  const purpose = c('guide.purpose')
  const doc = c('guide.doc_text')
  return (
    <div className="space-y-10">
      <Section en="Purpose" zh="一、宗旨">
        <p className="text-xs text-white leading-normal">{t(purpose.en, purpose.zh)}</p>
      </Section>

      <Section en="Working Hours" zh="二、工作時間">
        <NumberedList items={[offline, ...zipLines(c('guide.hours'))]} />
      </Section>

      <Section en="Notes" zh="三、注意事項">
        <NumberedList items={zipLines(c('guide.notes'))} />
      </Section>

      <Section en="Penalties" zh="四、罰款">
        <NumberedList items={zipLines(c('guide.penalties'))} />
      </Section>

      <Section en="Deposit" zh="五、押金">
        <NumberedList items={zipLines(c('guide.deposits'))} />
      </Section>

      <Section en="Booking Steps" zh="六、預約流程">
        <NumberedList items={zipLines(c('guide.steps'))} />
      </Section>

      <Section en="Full Guide" zh="七、完整使用說明">
        <a
          href={c('guide.doc_url').zh}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white underline underline-offset-4 hover:opacity-50 self-start"
        >
          {t(doc.en, doc.zh)}
        </a>
      </Section>

      <Section en="Contact" zh="八、聯絡方式">
        <ContactList contacts={contactsFrom(c)} />
      </Section>
    </div>
  )
}

export default GuideContent
