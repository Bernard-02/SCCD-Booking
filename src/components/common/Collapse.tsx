/**
 * Collapse 組件
 * 展開／收合動畫（高度自動）：grid-rows 0fr↔1fr 過渡，純 CSS、不用量高度。
 * 內容一律渲染；收合時高度 0 並設 inert（鍵盤 Tab 與讀屏都進不去裡面的按鈕）。
 * 用於 Profile 訂單 accordion、購物車訂單組。
 */

import React, { useEffect, useRef } from 'react'

const Collapse: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => {
  const ref = useRef<HTMLDivElement>(null)
  // React 18 還不認得 inert prop，直接設 DOM 屬性
  useEffect(() => {
    if (ref.current) ref.current.inert = !open
  }, [open])

  return (
    <div
      ref={ref}
      className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  )
}

export default Collapse
