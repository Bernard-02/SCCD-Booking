/**
 * SaDialog 組件
 * 系學會資訊 lightbox：學會簡介、服務項目、聯絡方式。
 * 點右上角 close 或背景 / ESC 皆可關閉，不換頁。
 * 內容為 mock 資料，直接改下方陣列即可。
 */

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CONTACTS, WEBSITE_CONTACT } from '../../data/contactInfo'
import ContactList from './ContactList'

interface SaDialogProps {
  isOpen: boolean
  onClose: () => void
}

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

// 區塊標題（左欄）：英文上、中文下
const SectionTitle: React.FC<{ en: string; zh: string }> = ({ en, zh }) => (
  <div>
    <div className="font-['Inter',_sans-serif] text-tiny text-[#cccccc]">{en}</div>
    <div className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-[#cccccc]">{zh}</div>
  </div>
)

const SaDialog: React.FC<SaDialogProps> = ({ isOpen, onClose }) => {
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

        {/* 標題區 */}
        <div className="px-8 pt-6 pb-5 pr-14 flex-shrink-0">
          <h2 className="font-['Inter',_sans-serif] text-small-title text-white font-medium">
            Student Association{' '}
            <span className="font-['Noto_Sans_TC',_sans-serif]">系學會</span>
          </h2>
        </div>

        {/* 可捲動內容區：左標題、右內容 */}
        <div className="px-8 pb-8 overflow-y-auto custom-scrollbar space-y-10">
          {/* 1. 學會簡介 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="About" zh="學會簡介" />
            <div>
              <p className="font-['Inter',_sans-serif] text-tiny text-white leading-relaxed">
                {ABOUT.en}
              </p>
              <p className="font-['Noto_Sans_TC',_sans-serif] text-tiny text-white leading-relaxed mt-2">
                {ABOUT.zh}
              </p>
            </div>
          </section>

          {/* 2. 服務項目 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Services" zh="服務項目" />
            <ul className="space-y-3">
              {SERVICES.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex-shrink-0 text-[#cccccc] text-tiny">・</span>
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
            </ul>
          </section>

          {/* 3. 聯絡方式 */}
          <section className="grid grid-cols-[140px_1fr] gap-6">
            <SectionTitle en="Contact" zh="聯絡方式" />
            <ContactList contacts={SA_CONTACTS} />
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

export default SaDialog
