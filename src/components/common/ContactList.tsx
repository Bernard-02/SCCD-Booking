/**
 * ContactList 組件
 * 渲染一組聯絡方式（Guide 與 SA lightbox 共用）。
 */

import React from 'react'
import type { Contact } from '../../data/contactInfo'

const ContactList: React.FC<{ contacts: Contact[] }> = ({ contacts }) => (
  <div className="space-y-4">
    {contacts.map((c, i) => (
      <div key={i}>
        <div className="text-tiny text-[#cccccc] mb-0.5">
          <span className="font-['Inter',_sans-serif]">{c.labelEn}</span>{' '}
          <span className="font-['Noto_Sans_TC',_sans-serif]">{c.labelZh}</span>
        </div>
        {c.link ? (
          <a
            href={c.link}
            {...(c.link.startsWith('http')
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
            className={`${c.linkText ? "font-['Inter',_sans-serif]" : "font-['Noto_Sans_TC',_sans-serif]"} text-tiny text-white font-bold hover:opacity-70 transition-opacity break-all`}
          >
            {c.linkText || c.zh}
          </a>
        ) : (
          c.zh && (
            <p
              className="text-tiny text-white leading-relaxed"
              style={{ fontFamily: "Inter, 'Noto Sans TC', sans-serif" }}
            >
              {c.zh}
            </p>
          )
        )}
        {c.en && (
          <p className="font-['Inter',_sans-serif] text-tiny text-white leading-relaxed">
            {c.en}
          </p>
        )}
      </div>
    ))}
  </div>
)

export default ContactList
