/**
 * AboutContent 組件
 * 關於（誰做的系統）內容（InfoDialog 的 About 分頁）；取代原本的 /about 獨立頁。
 * 依介面語言只顯示一種；文字從 site_content 讀（後台「文字內容」頁可改，內建預設在 data/siteContent.ts）。
 */

import React from 'react'
import { useT } from '../../stores/langStore'
import { zipLines } from '../../data/siteContent'
import { useSiteContent } from '../../services/contentService'

const AboutContent: React.FC = () => {
  const t = useT()
  const c = useSiteContent()
  const quote = c('about.quote')
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {zipLines(c('about.paragraphs')).map((p, i) => (
          <p key={i} className="text-xs text-white leading-relaxed">{t(p.en, p.zh)}</p>
        ))}
      </div>

      <blockquote className="border-l-2 border-gray-mid pl-4">
        <p className="text-xs text-gray-light leading-relaxed">{t(quote.en, quote.zh)}</p>
      </blockquote>
    </div>
  )
}

export default AboutContent
