/**
 * GuideContent 組件
 * 使用教學內容（InfoDialog 的 Guide 分頁）：說明如何使用借用系統。
 * 內容為 mock 資料，直接改下方陣列即可。
 */

import React from 'react'
import { CONTACTS } from '../../data/contactInfo'
import ContactList from './ContactList'
import { useT } from '../../stores/langStore'
import { useDutyHours } from '../../services/ordersService'

// 預約流程步驟
const STEPS: { en: string; zh: string; descEn: string; descZh: string }[] = [
  { en: 'Log in', zh: '登入', descEn: 'Sign in with your student ID.', descZh: '使用學號登入 SCCDSA Booking。' },
  { en: 'Browse the catalog', zh: '瀏覽型錄', descEn: 'Open Catalog and pick Equipment or Space.', descZh: '進入「型錄」，選擇設備或空間。' },
  {
    en: 'Choose dates & quantity',
    zh: '選擇日期與數量',
    descEn: 'Select dates and quantity, then add to cart. Space bookings are limited to 14 days (30 days for 4th-year and graduate students); equipment up to 30 days.',
    descZh: '選擇借用日期與數量後加入清單。空間預約以 14 天為限（四年級、碩士班可至 30 天），設備以 30 天為限。'
  },
  {
    en: 'Review & submit',
    zh: '確認並送出',
    descEn: 'Check your cart and fill in the booking details — bulk/group orders must include the class and responsible teacher — then submit to get a receipt.',
    descZh: '在「清單」確認品項與日期，填寫借用資訊（大量／團體訂單須填寫使用班級與負責老師）後送出，取得收據編號。'
  },
  {
    en: 'Pay the deposit',
    zh: '繳交押金',
    descEn: 'Pay the cash deposit at the SA before your start date — the booking only takes effect once the deposit is paid.',
    descZh: '於開始使用日前攜帶收據至系學會繳交現金押金；繳交押金後預約才算成立，未繳交視為無效預約。'
  },
  {
    en: 'Return & refund',
    zh: '歸還退押金',
    descEn: 'Complete the "clean return" by 19:01 on the return date; show the receipt to get your full deposit back.',
    descZh: '於歸還日 19:01（下班時間）前完成「清潔歸還」，憑收據取回全額押金。'
  }
]

// 宗旨
const PURPOSE = {
  en: 'The Booking system lets you reserve or apply for the spaces and equipment managed by the SCCD Student Association. All regulations are available on the SCCD Drive.',
  zh: 'Booking 預約系統可預約或申請使用系學會管理之空間與設備，所有規章條例位於 SCCD Drive。'
}

// 工作時間：第一條（線下）的時段＝後台排的值班時段，見 workHours()
const WORK_HOURS_REST: { en: string; zh: string }[] = [
  {
    en: 'Online: weekdays 10:00–19:00 via Messenger — state your class and name.',
    zh: '線上：平日 10:00–19:00，透過 Messenger 傳送訊息並告知班級、姓名。'
  },
  {
    en: 'Closed on weekends and holidays; all SA contact must be within working hours.',
    zh: '週末及節假日不開放不回訊；所有與系學會的聯絡均須在工作時間內。'
  }
]

// 注意事項
const NOTES: { en: string; zh: string }[] = [
  {
    en: 'A booking or application is only valid after the deposit is paid — pay at the SA before your start date.',
    zh: '所有預約／申請於繳交押金後才算成立，請於開始使用日前至系學會完成，未繳交視為無效。'
  },
  {
    en: 'Check the condition together at handover — photos or videos are recommended to avoid disputes.',
    zh: '交接當下請確認預約對象之狀況，建議拍照或錄影以避免爭議。'
  },
  {
    en: 'No booking on behalf of others; contact the SA if the booked item needs to be changed.',
    zh: '不得代他人預約，不得私自更換預約對象，如需更換請洽系學會。'
  },
  {
    en: 'Bulk/group orders require at least 10 items plus the class and responsible teacher; bulk equipment must start at least 3 days ahead.',
    zh: '大量／團體訂單需至少 10 件、填寫使用班級與負責老師；大量設備起租日須為至少 3 天後。'
  },
  {
    en: 'Follow the Space & Equipment Regulations at all times; construction work must follow the Construction Guidelines.',
    zh: '全程遵守【空間與設備管理規章】；施工須全程遵守「施工規範」。'
  }
]

// 罰款
const PENALTIES: { en: string; zh: string }[] = [
  {
    en: 'Using SA-managed spaces or equipment without a booking: NT$ 200 fine per instance.',
    zh: '未經預約使用系學會管理之空間或設備，罰款 200 元／次。'
  },
  {
    en: 'Late returns count from 19:01 on the return date: NT$ 100 on day 1, doubling daily (weekends and holidays excluded), capped at your total deposit.',
    zh: '歸還日 19:01 起算逾期：第 1 日罰 100 元，之後每日翻倍（週末及節假日不計），上限為押金總額。'
  },
  {
    en: 'Reaching the deposit cap or being 6 days late counts as failing the "clean return" and bars you from the booking system.',
    zh: '罰款達押金總額或逾期達 6 日者，視為未完成「清潔歸還」，將不得再使用預約系統。'
  },
  {
    en: 'Minor damage is fined by severity or offset by department cleaning service; severe damage also covers full repair or replacement costs.',
    zh: '輕微損壞視程度罰款或以學系清潔勞動服務抵扣；嚴重損壞須視程度罰款並全權承擔維修或換新費用。'
  }
]

// 押金
const DEPOSITS: { en: string; zh: string }[] = [
  {
    en: 'Cash only, counted in person; deposits are capped at NT$ 5,000 for spaces and NT$ 5,000 for equipment, counted separately.',
    zh: '押金限收現金、當面點清；空間類、設備類總額上限各 5,000 元，分開計算。'
  },
  {
    en: 'Spaces: NT$ 1,000 per block in the numbered area (NT$ 2,000 for the back terrace); NT$ 5,000 per classroom.',
    zh: '空間：編號區每磚 1,000 元（後陽台 2,000 元）、教室每間 5,000 元。'
  },
  {
    en: 'Equipment: NT$ 500 per item for personal bookings; NT$ 5,000 per group order.',
    zh: '設備：個人預約每件 500 元、團體預約每次 5,000 元。'
  },
  {
    en: 'The deposit is fully refunded after the "clean return" is confirmed by the SA.',
    zh: '完成「清潔歸還」並經系學會確認後，全額退還押金。'
  }
]

// 區塊：左欄標題（灰）、右欄內容；標題在該段範圍內 sticky（top-16＝InfoDialog 標題高度）。SA 分頁共用
export const Section: React.FC<{ en: string; zh: string; children: React.ReactNode }> = ({ en, zh, children }) => {
  const t = useT()
  return (
    <section className="grid grid-cols-[140px_1fr] gap-6">
      <h3 className="sticky top-16 self-start text-xs text-[#cccccc]">{t(en, zh)}</h3>
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
            {r.descZh && <p className="text-[#cccccc] leading-relaxed mt-1">{t(r.descEn ?? r.descZh, r.descZh)}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

// 預約流程併成「步驟：說明」一行，與其他段同樣用數字條列
const STEP_ITEMS = STEPS.map(s => ({ en: `${s.en}: ${s.descEn}`, zh: `${s.zh}：${s.descZh}` }))

const GuideContent: React.FC = () => {
  const t = useT()
  const hours = useDutyHours() // undefined＝載入中、null＝尚未排班
  const offline = hours
    ? { en: `Offline: ${hours.en} at A502 — knock and state your class and name.`, zh: `線下：${hours.zh}，至 A502 室，入內請敲門並告知班級、姓名。` }
    : { en: `Offline: ${hours === null ? 'hours not announced yet (see Facebook)' : '…'} at A502 — knock and state your class and name.`,
        zh: `線下：${hours === null ? '時段尚未公布（請見 Facebook）' : '…'}，至 A502 室，入內請敲門並告知班級、姓名。` }
  return (
    <div className="space-y-10">
      <Section en="Purpose" zh="一、宗旨">
        <p className="text-xs text-white leading-normal">{t(PURPOSE.en, PURPOSE.zh)}</p>
      </Section>

      <Section en="Working Hours" zh="二、工作時間">
        <NumberedList items={[offline, ...WORK_HOURS_REST]} />
      </Section>

      <Section en="Notes" zh="三、注意事項">
        <NumberedList items={NOTES} />
      </Section>

      <Section en="Penalties" zh="四、罰款">
        <NumberedList items={PENALTIES} />
      </Section>

      <Section en="Deposit" zh="五、押金">
        <NumberedList items={DEPOSITS} />
      </Section>

      <Section en="Booking Steps" zh="六、預約流程">
        <NumberedList items={STEP_ITEMS} />
      </Section>

      <Section en="Full Guide" zh="七、完整使用說明">
        <a
          href="https://docs.google.com/document/d/1m4i89PruGw1ih7NehOEbR_vdNx7KKpTT1svbM1aOIvQ/edit?usp=sharing"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white underline underline-offset-4 hover:opacity-70 self-start"
        >
          {t('Booking System Usage Guide', 'Booking 預約系統使用說明（Google 文件）')}
        </a>
      </Section>

      <Section en="Contact" zh="八、聯絡方式">
        <ContactList contacts={CONTACTS} />
      </Section>
    </div>
  )
}

export default GuideContent
