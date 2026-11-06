/**
 * 手機寬度判斷（CLAUDE.md RWD 標準：md 768px 為分界）。
 * 排列差異用 CSS（max-md:）就好，只有「渲染內容不同」才用這個，例如 Calendar 單月／雙月。
 */

import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 767px)'

export const useIsMobile = () => useSyncExternalStore(
  onChange => {
    const mq = window.matchMedia(QUERY)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  },
  () => window.matchMedia(QUERY).matches
)
