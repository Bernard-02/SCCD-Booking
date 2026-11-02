/**
 * 系學會聯絡資訊（Guide 與 SA 兩個 lightbox 共用）
 * 項目與順序固定在這裡；文字（地址、備註、粉專、信箱、官網）從 site_content 讀，後台「文字內容」頁可改。
 */

import type { Bilingual } from './siteContent'

export interface Contact {
  labelEn: string
  labelZh?: string
  icon: string        // Material Symbols 名稱；'facebook' 由 ContactList 換成品牌 SVG
  zh?: string
  en?: string
  link?: string
  linkText?: string
  note?: string
  noteEn?: string
  dutyHours?: true    // 內容＝後台排的值班時段（ContactList 用 useDutyHours 填）
}

/** 聯絡方式清單；c＝useSiteContent() 的取值函式 */
export const contactsFrom = (c: (key: string) => Bilingual): Contact[] => {
  const address = c('contact.address')
  const note = c('contact.hours_note')
  const fb = c('contact.facebook')
  const email = c('contact.email').zh
  return [
    { labelEn: 'Location', icon: 'location_on', labelZh: '地點', zh: address.zh, en: address.en },
    { labelEn: 'Hours', icon: 'schedule', labelZh: '營業時間', dutyHours: true, note: note.zh, noteEn: note.en },
    { labelEn: 'Facebook', icon: 'facebook', zh: fb.zh, en: fb.en, link: c('contact.facebook_url').zh },
    { labelEn: 'Email', icon: 'mail', labelZh: '信箱', link: `mailto:${email}`, linkText: email }
  ]
}

// 官網（SA popup 額外加上）
export const websiteContactFrom = (c: (key: string) => Bilingual): Contact => ({
  labelEn: 'Website', icon: 'language', labelZh: '官網', link: c('contact.website_url').zh, linkText: c('contact.website_text').zh
})
