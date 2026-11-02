/**
 * 可在後台改的文字（site_content 表，supabase/site-content.sql；後台「文字內容」頁）
 * 架構固定在程式裡（哪些段落、順序、版型），只有文字從這裡的 key 讀：使用教學、系學會分頁、關於、聯絡方式、延期規則。
 * 這裡的 zh／en 是內建預設：表裡沒有那個 key、或存的是空白，就用內建的；英文空白退回中文（EN 模式看到中文＝提醒要補）。
 * 條列型（lines）一行一項，中英各自一行對一行；英文行數不夠的那幾行顯示中文。
 * 提示文字（Toast／錯誤訊息）不在這裡，那些綁程式行為，改程式。
 */

export type ContentEntry = {
  key: string
  group: 'guide' | 'sa' | 'contact' | 'about' | 'extend'
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
  { id: 'guide', label: '使用教學', desc: 'ⓘ → 使用教學。段落標題與順序固定，改內容。' },
  { id: 'sa', label: '系學會', desc: 'ⓘ → 系學會。' },
  { id: 'contact', label: '聯絡方式', desc: '使用教學與系學會分頁共用；營業時間本身由「營業時間」頁的值班表自動帶入。' },
  { id: 'about', label: '誰做的系統', desc: 'ⓘ → 誰做的系統。' },
  { id: 'extend', label: '延期規則', desc: 'Profile 訂單「延期」對話框裡展開的規則說明。只是說明文字，實際天數限制在程式裡。' }
]

export const CONTENT: ContentEntry[] = [
  // ---- 使用教學 ----
  {
    key: 'guide.purpose', group: 'guide', label: '一、宗旨',
    zh: 'Booking 預約系統可預約或申請使用系學會管理之空間與設備，所有規章條例位於 SCCD Drive。',
    en: 'The Booking system lets you reserve or apply for the spaces and equipment managed by the SCCD Student Association. All regulations are available on the SCCD Drive.'
  },
  {
    key: 'guide.hours_offline', group: 'guide', label: '二、工作時間：線下（第 1 條）',
    hint: '{hours} 會換成「營業時間」頁排的值班時段，例如「週一～五 12:00–13:00、17:00–19:00」。',
    zh: '線下：{hours}，至 A502 室，入內請敲門並告知班級、姓名。',
    en: 'Offline: {hours} at A502 — knock and state your class and name.'
  },
  {
    key: 'guide.hours', group: 'guide', label: '二、工作時間：其他（第 2 條起）', lines: true,
    zh: '線上：平日 10:00–19:00，透過 Messenger 傳送訊息並告知班級、姓名。\n週末及節假日不開放不回訊；所有與系學會的聯絡均須在工作時間內。',
    en: 'Online: weekdays 10:00–19:00 via Messenger — state your class and name.\nClosed on weekends and holidays; all SA contact must be within working hours.'
  },
  {
    key: 'guide.notes', group: 'guide', label: '三、注意事項', lines: true,
    zh: [
      '所有預約／申請於繳交押金後才算成立，請於開始使用日前至系學會完成，未繳交視為無效。',
      '交接當下請確認預約對象之狀況，建議拍照或錄影以避免爭議。',
      '不得代他人預約，不得私自更換預約對象，如需更換請洽系學會。',
      '大量／團體訂單需至少 10 件、填寫使用班級與負責老師；大量設備起租日須為至少 3 天後。',
      '全程遵守【空間與設備管理規章】；施工須全程遵守「施工規範」。'
    ].join('\n'),
    en: [
      'A booking or application is only valid after the deposit is paid — pay at the SA before your start date.',
      'Check the condition together at handover — photos or videos are recommended to avoid disputes.',
      'No booking on behalf of others; contact the SA if the booked item needs to be changed.',
      'Bulk/group orders require at least 10 items plus the class and responsible teacher; bulk equipment must start at least 3 days ahead.',
      'Follow the Space & Equipment Regulations at all times; construction work must follow the Construction Guidelines.'
    ].join('\n')
  },
  {
    key: 'guide.penalties', group: 'guide', label: '四、罰款', lines: true,
    zh: [
      '未經預約使用系學會管理之空間或設備，罰款 200 元／次。',
      '歸還日 19:01 起算逾期：第 1 日罰 100 元，之後每日翻倍（週末及節假日不計），上限為押金總額。',
      '罰款達押金總額或逾期達 6 日者，視為未完成「清潔歸還」，將不得再使用預約系統。',
      '輕微損壞視程度罰款或以學系清潔勞動服務抵扣；嚴重損壞須視程度罰款並全權承擔維修或換新費用。'
    ].join('\n'),
    en: [
      'Using SA-managed spaces or equipment without a booking: NT$ 200 fine per instance.',
      'Late returns count from 19:01 on the return date: NT$ 100 on day 1, doubling daily (weekends and holidays excluded), capped at your total deposit.',
      'Reaching the deposit cap or being 6 days late counts as failing the "clean return" and bars you from the booking system.',
      'Minor damage is fined by severity or offset by department cleaning service; severe damage also covers full repair or replacement costs.'
    ].join('\n')
  },
  {
    key: 'guide.deposits', group: 'guide', label: '五、押金', lines: true,
    zh: [
      '押金限收現金、當面點清；空間類、設備類總額上限各 5,000 元，分開計算。',
      '空間：編號區每磚 1,000 元（後陽台 2,000 元）、教室每間 5,000 元。',
      '設備：個人預約每件 500 元、團體預約每次 5,000 元。',
      '完成「清潔歸還」並經系學會確認後，全額退還押金。'
    ].join('\n'),
    en: [
      'Cash only, counted in person; deposits are capped at NT$ 5,000 for spaces and NT$ 5,000 for equipment, counted separately.',
      'Spaces: NT$ 1,000 per block in the numbered area (NT$ 2,000 for the back terrace); NT$ 5,000 per classroom.',
      'Equipment: NT$ 500 per item for personal bookings; NT$ 5,000 per group order.',
      'The deposit is fully refunded after the "clean return" is confirmed by the SA.'
    ].join('\n')
  },
  {
    key: 'guide.steps', group: 'guide', label: '六、預約流程', lines: true, hint: '每行一步，「步驟：說明」。',
    zh: [
      '登入：使用學號登入 SCCDSA Booking。',
      '瀏覽型錄：進入「型錄」，選擇設備或空間。',
      '選擇日期與數量：選擇借用日期與數量後加入清單。空間預約以 14 天為限（四年級、碩士班可至 30 天），設備以 30 天為限。',
      '確認並送出：在「清單」確認品項與日期，填寫借用資訊（大量／團體訂單須填寫使用班級與負責老師）後送出，取得收據編號。',
      '繳交押金：於開始使用日前攜帶收據至系學會繳交現金押金；繳交押金後預約才算成立，未繳交視為無效預約。',
      '歸還退押金：於歸還日 19:01（下班時間）前完成「清潔歸還」，憑收據取回全額押金。'
    ].join('\n'),
    en: [
      'Log in: Sign in with your student ID.',
      'Browse the catalog: Open Catalog and pick Equipment or Space.',
      'Choose dates & quantity: Select dates and quantity, then add to cart. Space bookings are limited to 14 days (30 days for 4th-year and graduate students); equipment up to 30 days.',
      'Review & submit: Check your cart and fill in the booking details — bulk/group orders must include the class and responsible teacher — then submit to get a receipt.',
      'Pay the deposit: Pay the cash deposit at the SA before your start date — the booking only takes effect once the deposit is paid.',
      'Return & refund: Complete the "clean return" by 19:01 on the return date; show the receipt to get your full deposit back.'
    ].join('\n')
  },
  {
    key: 'guide.doc_text', group: 'guide', label: '七、完整使用說明：連結文字',
    zh: 'Booking 預約系統使用說明（Google 文件）', en: 'Booking System Usage Guide'
  },
  {
    key: 'guide.doc_url', group: 'guide', label: '七、完整使用說明：連結網址', single: true,
    zh: 'https://docs.google.com/document/d/1m4i89PruGw1ih7NehOEbR_vdNx7KKpTT1svbM1aOIvQ/edit?usp=sharing', en: ''
  },

  // ---- 系學會 ----
  {
    key: 'sa.about', group: 'sa', label: '一、學會簡介',
    zh: '實踐媒體傳達設計系系學會（SCCDSA）由系上學生組成，負責設備與空間的租借管理、活動舉辦與同學服務，協助大家更順利地完成課程與創作。',
    en: 'The SCCD Student Association (SCCDSA) is run by students of the Department of Communications Design at Shih Chien University. We manage the borrowing of equipment and spaces, host events, and support fellow students throughout their coursework and creative projects.'
  },
  {
    key: 'sa.services', group: 'sa', label: '二、服務項目', lines: true, hint: '每行一項，「項目：說明」，說明會顯示在第二行灰字。',
    zh: '設備租借：相機、燈光、收音等設備借用。\n空間租借：教室與 A5F 編號區域空間預約。\n專業攝影棚：專業攝影棚使用申請。\n活動舉辦：系上活動與工作坊。',
    en: 'Equipment rental: Cameras, lighting, audio and more.\nSpace rental: Classrooms and A5F numbered areas.\nFilm studio: Access to the professional film studio.\nEvents: Department events and workshops.'
  },

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
