/**
 * InfoDialog 組件
 * Header 的 Info icon 開啟：左側分頁（使用教學／系學會／關於）、右側內容，不換頁。
 * 點右上角 close 或背景 / ESC 皆可關閉。
 */

import React, { useEffect } from 'react'
import CloseButton from './CloseButton'
import { createPortal } from 'react-dom'
import GuideContent from './GuideContent'
import SaContent from './SaContent'
import AboutContent from './AboutContent'
import { useT } from '../../stores/langStore'
import { navItemCls } from './navItem'

export type InfoTab = 'guide' | 'sa' | 'about'

const TABS: { id: InfoTab; en: string; zh: string; Content: React.FC }[] = [
  { id: 'guide', en: 'User Guide', zh: '使用教學', Content: GuideContent },
  { id: 'sa', en: 'Student Association', zh: '系學會', Content: SaContent },
  { id: 'about', en: 'Who Made This', zh: '誰做的系統', Content: AboutContent },
]

interface InfoDialogProps {
  tab: InfoTab | null // null＝關閉
  onTabChange: (tab: InfoTab) => void
  onClose: () => void
}

const InfoDialog: React.FC<InfoDialogProps> = ({ tab, onTabChange, onClose }) => {
  const t = useT()
  const isOpen = tab !== null

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

  const current = TABS.find(t => t.id === tab)!

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onClose}
    >
      {/* 對話框容器：固定高度，切分頁時不跳動 */}
      <div
        className="bg-[#151515] border border-[#545454] rounded-2xl max-w-4xl w-full mx-4 h-[85vh] flex flex-col md:flex-row relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        {/* 右上：關閉 X（與右側標題同在距頂 24px；z-20 蓋過 sticky 標題） */}
        <CloseButton onClick={onClose} label={t('Close', '關閉')} className="absolute top-6 right-6 z-20" />

        {/* 左：分頁膠囊（共用 navItemCls，無 icon）；桌機寬度跟最長的分頁走（min 200px，英文 Student Association 較長）；手機版分頁橫排在上，右側留位給 X */}
        <div className="p-6 pr-16 md:pr-6 md:min-w-[200px] flex-shrink-0 border-b md:border-b-0 md:border-r border-[#545454]">
          <nav className="inline-flex md:flex-col gap-1" role="tablist">
            {TABS.map(item => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === tab}
                onClick={() => onTabChange(item.id)}
                className={`${navItemCls(item.id === tab, false)} whitespace-nowrap`}
              >
                {t(item.en, item.zh)}
              </button>
            ))}
          </nav>
        </div>

        {/* 右：內容（key＝分頁，切換時捲動回頂端）。
            標題 sticky 固定 h-16（pt-6 與右上關閉 X 同高）；各段 Section 標題以 top-16 黏在它下方——改標題高度要一起改 */}
        <div key={tab} className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6" role="tabpanel">
          <h2 className="sticky top-0 z-10 h-16 pt-6 mb-4 bg-[#151515] text-sm text-white font-normal">
            {t(current.en, current.zh)}
          </h2>
          <current.Content />
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

export default InfoDialog
