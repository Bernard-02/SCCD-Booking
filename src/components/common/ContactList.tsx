/**
 * ContactList 組件
 * 渲染一組聯絡方式（InfoDialog 的 Guide 與 SA 分頁共用）；依介面語言只顯示一種，缺英文時退回中文。
 */

import React from 'react'
import type { Contact } from '../../data/contactInfo'
import { useT } from '../../stores/langStore'

const ContactList: React.FC<{ contacts: Contact[] }> = ({ contacts }) => {
  const t = useT()
  return (
    <div className="space-y-4">
      {contacts.map((c, i) => {
        const value = c.linkText || (c.zh && t(c.en ?? c.zh, c.zh))
        const note = c.note && t(c.noteEn ?? c.note, c.note)
        return (
          <div key={i}>
            <div className="text-xs text-[#cccccc] mb-0.5">{t(c.labelEn, c.labelZh ?? c.labelEn)}</div>
            {c.link ? (
              <a
                href={c.link}
                {...(c.link.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
                className="text-xs text-white font-bold hover:opacity-70 transition-opacity break-all"
              >
                {value}
              </a>
            ) : (
              value && <p className="text-xs text-white leading-relaxed">{value}</p>
            )}
            {note && <p className="text-xs text-[#cccccc] leading-relaxed mt-0.5">{note}</p>}
          </div>
        )
      })}
    </div>
  )
}

export default ContactList
