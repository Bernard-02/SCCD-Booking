/**
 * 系學會聯絡資訊（單一來源）
 * Guide 與 SA 兩個 lightbox 共用，改這裡兩邊同步更新。
 */

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

export const CONTACTS: Contact[] = [
  {
    labelEn: 'Location',
    icon: 'location_on',
    labelZh: '地點',
    zh: '台灣台北市中山區大直街 70 號 實踐大學 A 棟 5 樓',
    en: '5F, Building A, Shih Chien University, No.70, Dazhi Street, Zhongshan District, Taipei City, Taiwan'
  },
  {
    labelEn: 'Hours',
    icon: 'schedule',
    labelZh: '營業時間',
    dutyHours: true,
    note: '＊營業時間可能變動，請以 Facebook 公告為準。',
    noteEn: '*Hours may change; please refer to Facebook announcements.'
  },
  {
    labelEn: 'Facebook',
    icon: 'facebook',
    zh: '實踐大學媒傳系系學會',
    link: 'https://www.facebook.com/sccdstudentassoc'
  },
  {
    labelEn: 'Email',
    icon: 'mail',
    labelZh: '信箱',
    link: 'mailto:sccdsa@gmail.com',
    linkText: 'sccdsa@gmail.com'
  }
]

// 官網（SA popup 額外加上）
export const WEBSITE_CONTACT: Contact = {
  labelEn: 'Website',
  icon: 'language',
  labelZh: '官網',
  link: 'https://sccd.usc.edu.tw/',
  linkText: 'sccd.usc.edu.tw'
}
