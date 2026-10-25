/**
 * SaContent 組件
 * 系學會資訊（InfoDialog 的 SA 分頁）：學會簡介、服務項目、聯絡方式。
 * 內容為 mock 資料，直接改下方陣列即可。
 */

import React from 'react'
import { CONTACTS, WEBSITE_CONTACT } from '../../data/contactInfo'
import ContactList from './ContactList'
import { Section, NumberedList } from './GuideContent'
import { useT } from '../../stores/langStore'

// 學會簡介
const ABOUT = {
  en: 'The SCCD Student Association (SCCDSA) is run by students of the Department of Communications Design at Shih Chien University. We manage the borrowing of equipment and spaces, host events, and support fellow students throughout their coursework and creative projects.',
  zh: '實踐媒體傳達設計系系學會（SCCDSA）由系上學生組成，負責設備與空間的租借管理、活動舉辦與同學服務，協助大家更順利地完成課程與創作。'
}

// 服務項目
const SERVICES: { en: string; zh: string; descEn: string; descZh: string }[] = [
  { en: 'Equipment rental', zh: '設備租借', descEn: 'Cameras, lighting, audio and more.', descZh: '相機、燈光、收音等設備借用。' },
  { en: 'Space rental', zh: '空間租借', descEn: 'Classrooms and A5F numbered areas.', descZh: '教室與 A5F 編號區域空間預約。' },
  { en: 'Film studio', zh: '專業攝影棚', descEn: 'Access to the professional film studio.', descZh: '專業攝影棚使用申請。' },
  { en: 'Events', zh: '活動舉辦', descEn: 'Department events and workshops.', descZh: '系上活動與工作坊。' }
]

// 聯絡方式（沿用 Guide 同一份，額外加上官網）
const SA_CONTACTS = [...CONTACTS, WEBSITE_CONTACT]

const SaContent: React.FC = () => {
  const t = useT()
  return (
    <div className="space-y-10">
      <Section en="About" zh="一、學會簡介">
        <p className="text-xs text-white leading-relaxed">{t(ABOUT.en, ABOUT.zh)}</p>
      </Section>

      <Section en="Services" zh="二、服務項目">
        <NumberedList items={SERVICES} />
      </Section>

      <Section en="Contact" zh="三、聯絡方式">
        <ContactList contacts={SA_CONTACTS} />
      </Section>
    </div>
  )
}

export default SaContent
