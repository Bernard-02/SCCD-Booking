/**
 * 段落型說明頁（ⓘ 使用教學／系學會）：一頁＝一串段落；一段＝標題＋一串積木（段落／編號條列／項目＋說明／連結／聯絡方式）。
 * 後台「文字內容」頁可拖曳排序、增刪段落與積木、改標題與內容（site_sections 表，supabase/site-sections.sql）。
 * 表裡該頁沒有任何列＝用這裡的內建段落。
 * 標題不含編號，顯示時依順序自動加「一、二、…」（中文）；英文空白退回中文（EN 模式看到中文＝提醒要補）。
 * 內容裡的 {hours} 顯示時換成「營業時間」頁排的值班時段。
 * 欄位型的（聯絡方式／關於／延期規則）仍在 siteContent.ts。
 */

export type SectionPage = 'guide' | 'sa'
export type BlockKind = 'text' | 'list' | 'titled' | 'link' | 'contact'

export interface Block {
  kind: BlockKind
  /** text：一行一段；list／titled：一行一項（中英一行對一行）；link：連結文字；contact：不用 */
  zh: string
  en: string
  /** link 用 */
  url: string
}

export interface SiteSection {
  titleZh: string
  titleEn: string
  blocks: Block[]
}

export const HOURS_TOKEN = '{hours}'

export const SECTION_PAGES: { id: SectionPage; label: string; desc: string }[] = [
  {
    id: 'guide', label: '使用教學',
    desc: 'ⓘ → 使用教學。標題自動編號（一、二、…）。內容裡的 {hours} 會換成「營業時間」頁排的值班時段；清單頁「完整使用說明」連結用這裡第一個「連結」積木的網址。'
  },
  { id: 'sa', label: '系學會', desc: 'ⓘ → 系學會。標題自動編號（一、二、…）。' }
]

export const BLOCK_KINDS: { id: BlockKind; label: string; icon: string; hint: string }[] = [
  { id: 'text', label: '段落', icon: 'notes', hint: '一行一段。' },
  { id: 'list', label: '編號條列', icon: 'format_list_numbered', hint: '一行一項、自動編號，中英一行對一行。' },
  { id: 'titled', label: '項目＋說明', icon: 'view_agenda', hint: '一行一項，「項目：說明」，說明顯示在第二行灰字。' },
  { id: 'link', label: '連結', icon: 'link', hint: '內容＝連結文字，網址另填。' },
  { id: 'contact', label: '聯絡方式', icon: 'contact_page', hint: '顯示「聯絡方式」分頁的資料（地點、營業時間、Facebook、信箱、官網）。' }
]

export const blankBlock = (kind: BlockKind): Block => ({ kind, zh: '', en: '', url: '' })
export const blankSection = (): SiteSection => ({ titleZh: '', titleEn: '', blocks: [] })

const blk = (kind: BlockKind, zh = '', en = '', url = ''): Block => ({ kind, zh, en, url })
const sec = (titleZh: string, titleEn: string, ...blocks: Block[]): SiteSection => ({ titleZh, titleEn, blocks })

export const DEFAULT_SECTIONS: Record<SectionPage, SiteSection[]> = {
  guide: [
    sec('宗旨', 'Purpose', blk('text',
      'Booking 預約系統可預約或申請使用系學會管理之空間與設備，所有規章條例位於 SCCD Drive。',
      'The Booking system lets you reserve or apply for the spaces and equipment managed by the SCCD Student Association. All regulations are available on the SCCD Drive.')),
    sec('工作時間', 'Working Hours', blk('list',
      [
        '線下：{hours}，至 A502 室，入內請敲門並告知班級、姓名。',
        '線上：平日 10:00–19:00，透過 Messenger 傳送訊息並告知班級、姓名。',
        '週末及節假日不開放不回訊；所有與系學會的聯絡均須在工作時間內。'
      ].join('\n'),
      [
        'Offline: {hours} at A502 — knock and state your class and name.',
        'Online: weekdays 10:00–19:00 via Messenger — state your class and name.',
        'Closed on weekends and holidays; all SA contact must be within working hours.'
      ].join('\n'))),
    sec('注意事項', 'Notes', blk('list',
      [
        '所有預約／申請於繳交押金後才算成立，請於開始使用日前至系學會完成，未繳交視為無效。',
        '交接當下請確認預約對象之狀況，建議拍照或錄影以避免爭議。',
        '不得代他人預約，不得私自更換預約對象，如需更換請洽系學會。',
        '大量／團體訂單需至少 10 件、填寫使用班級與負責老師；大量設備起租日須為至少 3 天後。',
        '起租日最遠可選今天起 30 天內。',
        '設備、空間各只能有一張未歸還的訂單：小量與大量、個人與團體不能並存，要等上一張歸還才能再借；部分歸還或部分延期拆出來的子單也算未歸還。',
        '個人空間一個時段只能借一間教室，團體不在此限。',
        '編號區、教室與系學會設備僅限已繳交系學會費者借用。',
        '以老師名義借用：填借用資訊時選「老師名義」，填老師名稱並上傳有老師簽名的證明文件（JPG、PNG 或 PDF），免押金；送出後請於 24 小時內到系學會核對。',
        '雷切機：一年級借用須上傳授課教師核可證明；每次使用時間由系學會現場確認，借用時請攜帶身分證件。',
        '全程遵守【空間與設備管理規章】；施工須全程遵守「施工規範」。'
      ].join('\n'),
      [
        'A booking or application is only valid after the deposit is paid — pay at the SA before your start date.',
        'Check the condition together at handover — photos or videos are recommended to avoid disputes.',
        'No booking on behalf of others; contact the SA if the booked item needs to be changed.',
        'Bulk/group orders require at least 10 items plus the class and responsible teacher; bulk equipment must start at least 3 days ahead.',
        'The start date can be at most 30 days from today.',
        'You can have one unreturned equipment order and one unreturned space order at a time: light and bulk, or personal and group, can\’t overlap, and split orders from partial returns or extensions count as unreturned.',
        'Personal bookings can include only one classroom per period; group bookings aren\’t limited.',
        'Numbered areas, classrooms and SA equipment are for students who have paid the Student Association fee.',
        'Booking under a teacher\’s name: choose it in the booking details, enter the teacher\’s name and upload a signed proof (JPG, PNG or PDF). No deposit is charged; bring the proof to the SA within 24 hours of submitting.',
        'Laser cutter: first-year students must upload their course teacher\’s approval; the SA confirms usage time on site, and please bring your ID when borrowing.',
        'Follow the Space & Equipment Regulations at all times; construction work must follow the Construction Guidelines.'
      ].join('\n'))),
    sec('罰款', 'Penalties', blk('list',
      [
        '未經預約使用系學會管理之空間或設備，罰款 200 元／次。',
        '歸還日 19:01 起算逾期：第 1 日罰 100 元，之後每日翻倍（週末及節假日不計），上限為押金總額。',
        '罰款達押金總額或逾期達 6 日者，視為未完成「清潔歸還」，將不得再使用預約系統。',
        '輕微損壞視程度罰款或以學系清潔勞動服務抵扣；嚴重損壞須視程度罰款並全權承擔維修或換新費用。',
        '損壞或遺失的罰款由系學會依狀況填寫，從押金扣除；超過押金的部分須另外繳交，繳清前無法再預約。'
      ].join('\n'),
      [
        'Using SA-managed spaces or equipment without a booking: NT$ 200 fine per instance.',
        'Late returns count from 19:01 on the return date: NT$ 100 on day 1, doubling daily (weekends and holidays excluded), capped at your total deposit.',
        'Reaching the deposit cap or being 6 days late counts as failing the "clean return" and bars you from the booking system.',
        'Minor damage is fined by severity or offset by department cleaning service; severe damage also covers full repair or replacement costs.',
        'Fines for damage or loss are set by the SA and taken from your deposit; anything above the deposit must be paid separately before you can book again.'
      ].join('\n'))),
    sec('押金', 'Deposit', blk('list',
      [
        '押金限收現金、當面點清；空間類、設備類總額上限各 5,000 元，分開計算。',
        '空間：編號區每磚 1,000 元（後陽台 2,000 元）、教室每間 5,000 元。',
        '設備：個人預約每件 500 元、團體預約每次 5,000 元。',
        '老師名義借用免押金。',
        '完成「清潔歸還」並經系學會確認後退還押金，有罰款時扣除罰款後退還。',
        '部分歸還不分批退押金，全部歸還後一次結算。'
      ].join('\n'),
      [
        'Cash only, counted in person; deposits are capped at NT$ 5,000 for spaces and NT$ 5,000 for equipment, counted separately.',
        'Spaces: NT$ 1,000 per block in the numbered area (NT$ 2,000 for the back terrace); NT$ 5,000 per classroom.',
        'Equipment: NT$ 500 per item for personal bookings; NT$ 5,000 per group order.',
        'Bookings under a teacher\’s name have no deposit.',
        'The deposit is refunded after the "clean return" is confirmed by the SA, minus any fines.',
        'Partial returns are not refunded in parts; the deposit is settled once everything is back.'
      ].join('\n'))),
    sec('預約流程', 'Booking Steps', blk('list',
      [
        '登入：使用學號登入 SCCDSA Booking。',
        '瀏覽型錄：進入「型錄」，選擇設備或空間。',
        '選擇日期與數量：選擇借用日期與數量後加入清單。空間預約以 14 天為限（四年級以上、碩士班可至 30 天），設備以 30 天為限（四年級以上不限）。',
        '確認並送出：在「清單」確認品項與日期，填寫借用資訊（大量／團體訂單須填寫使用班級與負責老師）後送出，取得收據編號。',
        '繳交押金：於開始使用日前攜帶收據至系學會繳交現金押金；繳交押金後預約才算成立，未繳交視為無效預約。',
        '大量設備取件：取件日為起租日，不開放提前。取件日 19:00 前未取件，訂單自動取消、設備釋放，不算違規，押金請至系學會領回。取件時段遇到公休會發通知，請在通知或訂單頁改到起租日前的值班時段，沒改同樣自動取消；繳押金時段遇到公休會順延到隔天。',
        '歸還退押金：於歸還日 19:01（下班時間）前完成「清潔歸還」，憑收據取回全額押金。'
      ].join('\n'),
      [
        'Log in: Sign in with your student ID.',
        'Browse the catalog: Open Catalog and pick Equipment or Space.',
        'Choose dates & quantity: Select dates and quantity, then add to cart. Space bookings are limited to 14 days (30 days for 4th-year and above, and graduate students); equipment up to 30 days (no limit for 4th-year and above).',
        'Review & submit: Check your cart and fill in the booking details — bulk/group orders must include the class and responsible teacher — then submit to get a receipt.',
        'Pay the deposit: Pay the cash deposit at the SA before your start date — the booking only takes effect once the deposit is paid.',
        'Bulk equipment pickup: pick up on your start date; early pickup isn\’t available. If you don\’t pick up by 19:00 that day, the order is canceled and the equipment released with no penalty — collect your deposit from the SA. If your pickup slot falls on a closure you\’ll be notified; move it to a staffed slot before your start date from the notification or your orders, or the order is canceled the same way. Deposit slots that fall on a closure move to the next day.',
        'Return & refund: Complete the "clean return" by 19:01 on the return date; show the receipt to get your full deposit back.'
      ].join('\n'))),
    sec('完整使用說明', 'Full Guide', blk('link',
      'Booking 預約系統使用說明（Google 文件）', 'Booking System Usage Guide',
      'https://docs.google.com/document/d/1m4i89PruGw1ih7NehOEbR_vdNx7KKpTT1svbM1aOIvQ/edit?usp=sharing')),
    sec('聯絡方式', 'Contact', blk('contact'))
  ],
  sa: [
    sec('學會簡介', 'About', blk('text',
      '實踐媒體傳達設計系系學會（SCCDSA）由系上學生組成，負責設備與空間的租借管理、活動舉辦與同學服務，協助大家更順利地完成課程與創作。',
      'The SCCD Student Association (SCCDSA) is run by students of the Department of Communications Design at Shih Chien University. We manage the borrowing of equipment and spaces, host events, and support fellow students throughout their coursework and creative projects.')),
    sec('服務項目', 'Services', blk('titled',
      '設備租借：相機、燈光、收音等設備借用。\n空間租借：教室與 A5F 編號區域空間預約。\n專業攝影棚：專業攝影棚使用申請。\n活動舉辦：系上活動與工作坊。',
      'Equipment rental: Cameras, lighting, audio and more.\nSpace rental: Classrooms and A5F numbered areas.\nFilm studio: Access to the professional film studio.\nEvents: Department events and workshops.')),
    sec('聯絡方式', 'Contact', blk('contact'))
  ]
}

/** 1→一 … 10→十、11→十一 … 20→二十；再多直接阿拉伯數字 */
export const cnNum = (n: number): string => {
  const CN = '一二三四五六七八九'
  if (n >= 1 && n <= 9) return CN[n - 1]
  if (n === 10) return '十'
  if (n > 10 && n < 20) return `十${CN[n - 11]}`
  if (n === 20) return '二十'
  return String(n)
}

/** 英文空白退回中文（標題與每個積木） */
export const resolveSection = (s: SiteSection): SiteSection => ({
  ...s,
  titleEn: s.titleEn.trim() ? s.titleEn : s.titleZh,
  blocks: s.blocks.map(b => ({ ...b, en: b.en.trim() ? b.en : b.zh }))
})
