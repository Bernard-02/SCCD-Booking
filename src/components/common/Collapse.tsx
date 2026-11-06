/**
 * Collapse 組件
 * 展開／收合動畫（高度自動）：grid-rows 0fr↔1fr 過渡，純 CSS、不用量高度。
 * 內容一律渲染；收合時高度 0 並設 inert（鍵盤 Tab 與讀屏都進不去裡面的按鈕）。
 * 用於 Profile 訂單 accordion、購物車訂單組。
 * below：只在該斷點以下收合、以上永遠展開（桌機一次呈現、手機可收），純 CSS 不用判斷寬度；
 * inert 不分寬度，這時改靠 invisible 擋 Tab。
 */

import React, { useEffect, useRef } from 'react'

const CLOSED_BELOW = {
  md: 'grid-rows-[1fr] max-md:grid-rows-[0fr] max-md:[&>div]:invisible',
  lg: 'grid-rows-[1fr] max-lg:grid-rows-[0fr] max-lg:[&>div]:invisible'
}

const Collapse: React.FC<{ open: boolean; below?: 'md' | 'lg'; children: React.ReactNode }> = ({ open, below, children }) => {
  const ref = useRef<HTMLDivElement>(null)
  // React 18 還不認得 inert prop，直接設 DOM 屬性
  useEffect(() => {
    if (ref.current) ref.current.inert = !open && !below
  }, [open, below])

  return (
    <div
      ref={ref}
      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr]' : below ? CLOSED_BELOW[below] : 'grid-rows-[0fr]'
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

export default Collapse
