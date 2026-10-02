/**
 * 值班頁自動更新：每 intervalMs 重抓一次（分頁在背景時跳過），切回分頁時立即重抓。
 * 值班頁面通常整天開著——不更新的話，學生剛下的單、剛轉逾期的單都看不到。
 * refresh 以 ref 保存，呼叫端不必 useCallback。
 */

import { useEffect, useRef } from 'react'

export function useAutoRefresh(refresh: () => unknown, intervalMs = 60_000) {
  const ref = useRef(refresh)
  ref.current = refresh

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') void ref.current()
    }
    const id = setInterval(run, intervalMs)
    document.addEventListener('visibilitychange', run)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', run)
    }
  }, [intervalMs])
}
