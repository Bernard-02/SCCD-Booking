/**
 * SaContent 組件
 * 系學會資訊（InfoDialog 的 SA 分頁）：學會簡介、服務項目、聯絡方式。
 * 段落架構固定；文字從 site_content 讀（後台「文字內容」頁可改，內建預設在 data/siteContent.ts）。
 */

import React from 'react'
import { contactsFrom, websiteContactFrom } from '../../data/contactInfo'
import { zipLines, splitTitled } from '../../data/siteContent'
import ContactList from './ContactList'
import { Section, NumberedList } from './GuideContent'
import { useT } from '../../stores/langStore'
import { useSiteContent } from '../../services/contentService'

const SaContent: React.FC = () => {
  const t = useT()
  const c = useSiteContent()
  const about = c('sa.about')
  return (
    <div className="space-y-10">
      <Section en="About" zh="一、學會簡介">
        <p className="text-xs text-white leading-relaxed">{t(about.en, about.zh)}</p>
      </Section>

      <Section en="Services" zh="二、服務項目">
        {/* 「項目：說明」一行一項，說明顯示在第二行灰字 */}
        <NumberedList items={zipLines(c('sa.services')).map(splitTitled)} />
      </Section>

      <Section en="Contact" zh="三、聯絡方式">
        <ContactList contacts={[...contactsFrom(c), websiteContactFrom(c)]} />
      </Section>
    </div>
  )
}

export default SaContent
