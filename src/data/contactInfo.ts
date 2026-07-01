/**
 * 系學會聯絡資訊（單一來源）
 * Guide 與 SA 兩個 lightbox 共用，改這裡兩邊同步更新。
 */

export interface Contact {
  labelEn: string
  labelZh: string
  zh?: string
  en?: string
  link?: string
  linkText?: string
}

export const CONTACTS: Contact[] = [
  {
    labelEn: 'Location',
    labelZh: '地點',
    zh: '台灣台北市中山區大直街 70 號 實踐大學 A 棟 5 樓',
    en: '5F, Building A, Shih Chien University, No.70, Dazhi Street, Zhongshan District, Taipei City, Taiwan'
  },
  {
    labelEn: 'Hours',
    labelZh: '營業時間',
    zh: '週一（Mon）至週五（Fri） 12:00–13:00、17:00–19:00'
  },
  {
    labelEn: 'Facebook',
    labelZh: 'FB',
    zh: '實踐大學媒傳系系學會',
    link: 'https://www.facebook.com/sccdstudentassoc'
  },
  {
    labelEn: 'Email',
    labelZh: '信箱',
    link: 'mailto:sccdsa@gmail.com',
    linkText: 'sccdsa@gmail.com'
  }
]

// 官網（SA popup 額外加上）
export const WEBSITE_CONTACT: Contact = {
  labelEn: 'Website',
  labelZh: '官網',
  link: 'https://sccd.usc.edu.tw/',
  linkText: 'sccd.usc.edu.tw'
}
