/**
 * GuideDialog 組件
 * 使用教學 lightbox：說明如何使用借用系統。
 * 點右上角 close 或背景 / ESC 皆可關閉，不換頁。
 * 內容為 mock 資料，直接改下方陣列即可。
 */

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CONTACTS } from '../../data/contactInfo'
import ContactList from './ContactList'

interface GuideDialogProps {
  isOpen: boolean
  onClose: () => void
}

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

// 工作時間
const WORK_HOURS: { en: string; zh: string }[] = [
  {
    en: 'Offline: weekdays 12:00–13:00 and 17:00–19:00 at A502 — knock and state your class and name.',
    zh: '線下：平日 12:00–13:00、17:00–19:00，至 A502 室，入內請敲門並告知班級、姓名。'
  },
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
    en: 'Bulk/group orders require at least 10 items, the class and responsible teacher, and a start date at least 3 days ahead.',
    zh: '大量／團體訂單需至少 10 件、填寫使用班級與負責老師，且起租日須為至少 3 天後。'
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
    en: 'Cash only, counted in person; the total deposit is capped at NT$ 5,000.',
    zh: '押金限收現金、當面點清，總額上限 5,000 元。'
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

// 區塊標題（左欄）：英文上、中文下
const SectionTitle: React.FC<{ en: string; zh: string }> = ({ en, zh }) => (
  <div>
    <div className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">{en}</div>
    <div className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">{zh}</div>
  </div>
)

// 中英雙語條列（工作時間／注意事項／罰款／押金共用）
const BulletList: React.FC<{ items: { en: string; zh: string }[] }> = ({ items }) => (
  <ul className="space-y-3">
    {items.map((r, i) => (
      <li key={i} className="flex gap-2">
        <span className="flex-shrink-0 text-[#cccccc] text-tiny">・</span>
        <div>
          <p className="font-['Inter',_sans-serif] text-tiny text-white leading-relaxed">{r.en}</p>
          <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-white leading-relaxed">{r.zh}</p>
        </div>
      </li>
    ))}
  </ul>
)

const GuideDialog: React.FC<GuideDialogProps> = ({ isOpen, onClose }) => {
  // 按 ESC 鍵關閉
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // 阻止背景滾動
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onClose}
    >
      {/* 對話框容器 */}
      <div
        className="bg-[#151515] border border-[#545454] rounded-lg max-w-4xl w-full mx-4 max-h-[85vh] flex flex-col relative"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 右上角關閉鈕 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:opacity-70 transition-opacity cursor-pointer flex items-center z-10"
          aria-label="Close"
        >
          <span className="material-icons text-[24px]">close</span>
        </button>

        {/* 標題區（往下留 padding，捲動時內容不會貼著標題） */}
        <div className="px-8 pt-6 pb-5 pr-14 flex-shrink-0">
          <h2 className="font-['Inter',_sans-serif] text-small-title text-white font-medium">
            User Guide{' '}
            <span className="font-['Noto_Sans_TC',_sans-serif]">使用教學</span>
          </h2>
        </div>

        {/* 可捲動內容區：左標題、右內容 */}
        <div className="px-8 pb-8 overflow-y-auto custom-scrollbar space-y-10">
          {/* 1. 宗旨 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Purpose" zh="宗旨" />
            <div>
              <p className="font-['Inter',_sans-serif] text-tiny text-white leading-relaxed">
                {PURPOSE.en}
              </p>
              <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-white leading-relaxed">
                {PURPOSE.zh}
              </p>
            </div>
          </section>

          {/* 2. 工作時間 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Working Hours" zh="工作時間" />
            <BulletList items={WORK_HOURS} />
          </section>

          {/* 3. 注意事項 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Notes" zh="注意事項" />
            <BulletList items={NOTES} />
          </section>

          {/* 4. 罰款 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Penalties" zh="罰款" />
            <BulletList items={PENALTIES} />
          </section>

          {/* 5. 押金 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Deposit" zh="押金" />
            <BulletList items={DEPOSITS} />
          </section>

          {/* 6. 預約流程 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Booking Steps" zh="預約流程" />
            <ol className="space-y-4">
              {STEPS.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full border border-[#545454] text-white text-tiny flex items-center justify-center font-['Inter',_sans-serif]">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-white text-tiny">
                      <span className="font-['Inter',_sans-serif]">{s.en}</span>{' '}
                      <span className="font-['Noto_Sans_TC',_sans-serif]">{s.zh}</span>
                    </p>
                    <p className="font-['Inter',_sans-serif] text-tiny text-[#cccccc] leading-relaxed mt-1">
                      {s.descEn}
                    </p>
                    <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc] leading-relaxed">
                      {s.descZh}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 7. 完整使用說明文件 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Full Guide" zh="完整使用說明" />
            <a
              href="https://docs.google.com/document/d/1gSzAqyPO922dO6Y61sYF070jZmntP8Kyjz24YQbp4uA/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-tiny text-white underline underline-offset-4 hover:opacity-70 transition-opacity self-start"
            >
              <span className="font-['Inter',_sans-serif]">Booking System Usage Guide</span>{' '}
              <span className="font-['Noto_Sans_TC',_sans-serif]">Booking 預約系統使用說明（Google 文件）</span>
            </a>
          </section>

          {/* 8. 聯絡方式 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Contact" zh="聯絡方式" />
            <ContactList contacts={CONTACTS} />
          </section>
        </div>
      </div>

      {/* 淡入動畫 */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>,
    document.body
  )
}

export default GuideDialog
