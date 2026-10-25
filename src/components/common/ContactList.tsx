/**
 * ContactList 組件
 * 渲染一組聯絡方式（InfoDialog 的 Guide 與 SA 分頁共用）；左 icon 右內容，標籤只給螢幕閱讀器。
 * 依介面語言只顯示一種，缺英文時退回中文。
 */

import React from 'react'
import type { Contact } from '../../data/contactInfo'
import { useT } from '../../stores/langStore'
import { useDutyHours } from '../../services/ordersService'

// Material Symbols 沒有品牌 logo，Facebook 用 Font Awesome Free 6.5.2 square-facebook（CC BY 4.0）；
// 方框約 17.5px，與 20px Material 圖形的視覺大小相當
const FacebookIcon = () => (
  <svg width="20" height="20" viewBox="0 0 448 512" fill="currentColor" aria-hidden="true">
    <path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64h98.2V334.2H109.4V256h52.8V222.3c0-87.1 39.4-127.5 125-127.5c16.2 0 44.2 3.2 55.7 6.4V172c-6-.6-16.5-1-29.6-1c-42 0-58.2 15.9-58.2 57.2V256h83.6l-14.4 78.2H255V480H384c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64z" />
  </svg>
)

const ContactList: React.FC<{ contacts: Contact[] }> = ({ contacts }) => {
  const t = useT()
  const hours = useDutyHours()
  return (
    <div className="space-y-4">
      {contacts.map((c, i) => {
        const value = c.dutyHours
          ? hours ? t(hours.en, hours.zh) : hours === null ? t('Not announced yet', '尚未公布') : '…'
          : c.linkText || (c.zh && t(c.en ?? c.zh, c.zh))
        const note = c.note && t(c.noteEn ?? c.note, c.note)
        return (
          <div key={i} className="flex gap-3">
            {/* 高 22px＝內文一行高（text-xs × leading-relaxed），icon 對齊第一行 */}
            <span className="flex-shrink-0 h-[22px] flex items-center text-[#cccccc]">
              {c.icon === 'facebook' ? (
                <FacebookIcon />
              ) : (
                // 字級用 inline style：Google Fonts 的 .material-symbols-outlined 未分層，蓋過 Tailwind text-*
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }} aria-hidden="true">{c.icon}</span>
              )}
              <span className="sr-only">{t(c.labelEn, c.labelZh ?? c.labelEn)}</span>
            </span>
            <div className="min-w-0">
              {c.link ? (
                <a
                  href={c.link}
                  {...(c.link.startsWith('http')
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                  className="text-xs text-white font-bold leading-relaxed hover:opacity-70 break-all"
                >
                  {value}
                </a>
              ) : (
                value && <p className="text-xs text-white leading-relaxed">{value}</p>
              )}
              {note && <p className="text-xs text-[#cccccc] leading-relaxed mt-0.5">{note}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ContactList
