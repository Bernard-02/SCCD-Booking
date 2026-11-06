/**
 * 可在後台改的欄位型文字（site_content 表，supabase/site-content.sql；後台「文字內容」頁）
 * 架構固定在程式裡，只有文字從這裡的 key 讀：關於、聯絡方式、延期規則。
 * 使用教學／系學會是段落型（後台可增刪、改標題、調順序），在 siteSections.ts（2026-11-03 搬出去）。
 * 這裡的 zh／en 是內建預設：表裡沒有那個 key、或存的是空白，就用內建的；英文空白退回中文（EN 模式看到中文＝提醒要補）。
 * 條列型（lines）一行一項，中英各自一行對一行；英文行數不夠的那幾行顯示中文。
 * 提示文字（Toast／錯誤訊息）不在這裡，那些綁程式行為，改程式。
 */

export type ContentEntry = {
  key: string
  group: 'contact' | 'about' | 'extend'
  label: string
  hint?: string
  /** 條列：一行一項 */
  lines?: true
  /** 只有一個值（網址、信箱），沒有英文欄 */
  single?: true
  zh: string
  en: string
}

export const CONTENT_GROUPS: { id: ContentEntry['group']; label: string; desc: string }[] = [
  { id: 'contact', label: '聯絡方式', desc: '使用教學與系學會分頁共用；營業時間本身由「營業時間」頁的值班表自動帶入。' },
  { id: 'about', label: '誰做的系統', desc: 'ⓘ → 誰做的系統。' },
  { id: 'extend', label: '延期規則', desc: 'Profile 訂單「延期」對話框裡展開的規則說明。只是說明文字，實際天數限制在程式裡。' }
]

export const CONTENT: ContentEntry[] = [
  // ---- 聯絡方式 ----
  {
    key: 'contact.address', group: 'contact', label: '地點',
    zh: '台灣台北市中山區大直街 70 號 實踐大學 A 棟 5 樓',
    en: '5F, Building A, Shih Chien University, No.70, Dazhi Street, Zhongshan District, Taipei City, Taiwan'
  },
  {
    key: 'contact.hours_note', group: 'contact', label: '營業時間備註',
    zh: '＊營業時間可能變動，請以 Facebook 公告為準。', en: '*Hours may change; please refer to Facebook announcements.'
  },
  { key: 'contact.facebook', group: 'contact', label: 'Facebook 粉專名稱', zh: '實踐大學媒傳系系學會', en: 'SCCD Student Association' },
  { key: 'contact.facebook_url', group: 'contact', label: 'Facebook 連結', single: true, zh: 'https://www.facebook.com/sccdstudentassoc', en: '' },
  { key: 'contact.email', group: 'contact', label: '信箱', single: true, zh: 'sccdsa@gmail.com', en: '' },
  { key: 'contact.website_url', group: 'contact', label: '官網連結（只在系學會分頁）', single: true, zh: 'https://sccd.usc.edu.tw/', en: '' },
  { key: 'contact.website_text', group: 'contact', label: '官網顯示文字', single: true, zh: 'sccd.usc.edu.tw', en: '' },

  // ---- 誰做的系統 ----
  {
    key: 'about.paragraphs', group: 'about', label: '敘事段落', lines: true, hint: '一行一段。',
    zh: [
      '租借，這件事情一直以來都是媒傳系必修的課題。大一的時候因為聽說 RAGIC 很難用，再加上剛好對 UI、UX 等設計感興趣，因此就自己做了一款 SCCD APP 的設計原型，設法去將所有大學時期會使用的功能進行整合。',
      '後來經過研究發現 APP 開發的成本其實比想像中的高，再加上各個平台（FB、DC、校務系統）的使用已經愈加成熟，造成開發 APP 的意義不大。我寫這一段到底有誰會去認真看啊？因此打算只單攻租借這件事情，並以網站的形式去解決目前遇到的問題。',
      '平台主要想通過系統化及自動化處理租借這件事情，提高使用者和管理者的效率。在開發的時候，我們重新設計了租借流程，變得更簡化及符合使用者體驗。另外，租借日期的選擇，參考了航空公司的日期選擇方法，場地編號區採用電影院選座位的方式處理，而租借清單則參考了購物車的系統。',
      '很開心大家可以使用我們製作的平台，讓我們學以致用。第一次製作那麽龐大的設計，如使用過程中遇到問題，還請多多包涵。'
    ].join('\n'),
    en: [
      "Borrowing gear has always been a required subject for the Communications Design department. In my freshman year, I heard RAGIC was hard to use, and since I happened to be into UI/UX design, I built a design prototype of an SCCD app on my own, trying to integrate every function we'd use throughout university.",
      'Later I found that developing an app actually costs far more than expected, and with platforms like FB, DC and the school system growing ever more mature, building an app made little sense. (Is anyone even reading this paragraph carefully?) So I decided to focus solely on borrowing, and to solve the problems at hand in the form of a website.',
      'The platform is mainly about handling borrowing in a systematic, automated way, improving efficiency for both users and administrators. While building it, we redesigned the borrowing flow to be simpler and more user-friendly. The date picker takes after how airlines let you choose dates, the numbered-area selection works like picking seats at a cinema, and the rental list is modeled on a shopping cart.',
      "We're really glad everyone can use the platform we built — it lets us put what we've learned into practice. This is our first time designing something this large, so please bear with us if you run into any problems while using it."
    ].join('\n')
  },
  {
    key: 'about.quote', group: 'about', label: '引言',
    zh: '「解決問題也是設計的一種，未來大家都可以依照這個基礎去改進」——媒傳系一位德高望重的老師高捷，曾經說過。',
    en: '"Solving problems is a form of design too; in the future everyone can build on and improve this foundation." — as Kao Chieh, a highly respected teacher in the Communications Design department, once said.'
  },

  // ---- 延期規則 ----
  {
    key: 'extend.rules', group: 'extend', label: '規則條列', lines: true,
    zh: '延期申請需在原訂單歸還日的前三天提出，且僅可以提出乙次申請。\n若訂單內的所有空間/設備無法同時延期，則無法提出申請。\n延期天數是原歸還日往後開始計算，可最多延期7天。',
    en: 'Extension requests must be submitted at least 3 days before the original return date, and only one request may be made per order.\nIf all spaces/equipment in the order cannot be extended together, the request cannot be submitted.\nExtension days are counted from the original return date, up to a maximum of 7 days.'
  },
  {
    key: 'extend.example', group: 'extend', label: '範例（灰字）',
    zh: '例：假設訂單的原歸還日是1/20，您需要在1/17（含）之前提出延期申請。您可以自由選擇延期的天數，最多7天。若選擇延期7天，則新的歸還日會更改至1/27日。',
    en: 'e.g. If the original return date is 1/20, you must apply by 1/17 (inclusive). You may extend up to 7 days; extending 7 days changes the new return date to 1/27.'
  }
]

export const CONTENT_BY_KEY: Record<string, ContentEntry> = Object.fromEntries(CONTENT.map(e => [e.key, e]))

export type Bilingual = { zh: string; en: string }

/** 表裡的值 → 實際顯示的值：中文空白用內建、英文空白退回中文 */
export const resolveContent = (key: string, row?: Bilingual | null): Bilingual => {
  const d = CONTENT_BY_KEY[key] ?? { zh: '', en: '' }
  const zh = row?.zh.trim() ? row.zh : d.zh
  const en = row?.en.trim() ? row.en : row?.zh.trim() ? zh : d.en || zh
  return { zh, en }
}

/** 條列：一行一項，中英一行對一行；英文行數不夠的顯示中文 */
export const zipLines = ({ zh, en }: Bilingual): Bilingual[] => {
  const split = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean)
  const zhs = split(zh)
  const ens = split(en)
  return zhs.map((z, i) => ({ zh: z, en: ens[i] ?? z }))
}

/** 「標題：說明」拆成兩段（中文全形冒號、英文「: 」），沒有冒號就整行是標題 */
export const splitTitled = (line: Bilingual): { zh: string; en: string; descZh?: string; descEn?: string } => {
  const cut = (s: string, sep: string) => {
    const i = s.indexOf(sep)
    return i < 0 ? [s] : [s.slice(0, i), s.slice(i + sep.length).trim()]
  }
  const [zh, descZh] = cut(line.zh, '：')
  const [en, descEn] = cut(line.en, line.en === line.zh ? '：' : ': ')
  return { zh, en, descZh, descEn }
}
