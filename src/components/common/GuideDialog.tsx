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
  { en: 'Choose dates & quantity', zh: '選擇日期與數量', descEn: 'Select your booking dates and quantity, then add to cart.', descZh: '選擇借用日期與數量後加入清單。' },
  { en: 'Review & submit', zh: '確認並送出', descEn: 'Check your cart, fill in the booking details and submit to get a receipt.', descZh: '在「清單」確認品項與日期，填寫借用資訊後送出，取得收據編號。' },
  { en: 'Pay the deposit', zh: '繳交押金', descEn: 'Bring the receipt to the SA during business hours to pay a cash deposit.', descZh: '營業時間內攜帶收據至系學會繳交現金押金以完成預約。' },
  { en: 'Return & refund', zh: '歸還退押金', descEn: 'Clean and return on the due date; show the receipt to get your deposit back.', descZh: '到期日清潔歸還，憑收據取回押金。' }
]

// 常見問題
const FAQS: { qEn: string; qZh: string; aEn: string; aZh: string }[] = [
  {
    qEn: 'Personal vs. bulk/group booking?',
    qZh: '個人借用和大量／團體借用差在哪？',
    aEn: 'Personal booking is for small, short-term use. Bulk/group booking also requires the class and responsible teacher.',
    aZh: '個人借用適合少量、短期；大量／團體借用需額外填寫使用班級與負責老師。'
  },
  {
    qEn: 'How is the deposit handled?',
    qZh: '押金怎麼計算與退還？',
    aEn: 'The deposit is calculated per item, paid in cash when borrowing, and fully refunded after an on-time, complete return.',
    aZh: '押金依品項計算，借用時以現金繳交，準時且完整歸還後全額退還。'
  },
  {
    qEn: 'How long can I borrow?',
    qZh: '可以借多久？',
    aEn: 'It depends on the item — follow the available period shown in your cart.',
    aZh: '依品項而定，請以清單上顯示的可借期間為準。'
  },
  {
    qEn: 'Lost the receipt or returning late?',
    qZh: '忘記帶收據或逾期怎麼辦？',
    aEn: 'Contact the SA as soon as possible; late returns may affect future borrowing.',
    aZh: '請盡快聯繫系學會處理；逾期可能影響後續借用權限。'
  }
]

// 規則與注意事項
const RULES: { en: string; zh: string }[] = [
  { en: 'Deposits are cash only, paid during SA business hours.', zh: '押金一律現金，僅於系學會營業時間繳交。' },
  { en: 'Clean and return all items in full by the due date.', zh: '請於歸還日前清潔並完整歸還設備。' },
  { en: 'Late returns or damage affect borrowing rights; damage is charged at cost.', zh: '逾期或損壞將影響借用權限，損壞照價賠償。' },
  { en: 'Bulk/group bookings must fill in the class and responsible teacher.', zh: '大量／團體借用須填寫使用班級與負責老師。' }
]

// 區塊標題（左欄）：英文上、中文下
const SectionTitle: React.FC<{ en: string; zh: string }> = ({ en, zh }) => (
  <div>
    <div className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">{en}</div>
    <div className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">{zh}</div>
  </div>
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
          {/* 1. 預約流程 */}
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

          {/* 2. 常見問題 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="FAQ" zh="常見問題" />
            <div className="space-y-4">
              {FAQS.map((f, i) => (
                <div key={i}>
                  <p className="text-white text-tiny">
                    <span className="font-['Inter',_sans-serif]">Q. {f.qEn}</span>{' '}
                    <span className="font-['Noto_Sans_TC',_sans-serif]">{f.qZh}</span>
                  </p>
                  <p className="font-['Inter',_sans-serif] text-tiny text-[#cccccc] leading-relaxed mt-1">
                    {f.aEn}
                  </p>
                  <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc] leading-relaxed">
                    {f.aZh}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 3. 規則與注意事項 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Rules & Notes" zh="規則與注意事項" />
            <ul className="space-y-3">
              {RULES.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex-shrink-0 text-[#cccccc] text-tiny">・</span>
                  <div>
                    <p className="font-['Inter',_sans-serif] text-tiny text-white leading-relaxed">
                      {r.en}
                    </p>
                    <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-white leading-relaxed">
                      {r.zh}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* 4. 聯絡方式 */}
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
