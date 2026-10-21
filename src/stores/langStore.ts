/**
 * 介面語言 Store（前台 中／EN 切換；後台只有中文）
 * 選擇存在 localStorage `sccd_lang`，預設中文。
 * 英文沿用原本雙語並列時的英文字串；只有中文的訊息（Toast、server 錯誤原因）尚未翻譯，兩種語言都顯示中文。
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Lang = 'zh' | 'en'

interface LangState {
  lang: Lang
  toggleLang: () => void
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: 'zh',
      toggleLang: () => set((s) => ({ lang: s.lang === 'zh' ? 'en' : 'zh' })),
    }),
    { name: 'sccd_lang' }
  )
)

// <html lang> 跟著切換（讀屏、字型 fallback 用）
const syncHtmlLang = (lang: Lang) => {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-TW'
}
syncHtmlLang(useLangStore.getState().lang)
useLangStore.subscribe((s) => syncHtmlLang(s.lang))

/** 依目前語言二選一：t('Login', '登入')，也可傳 JSX；後台（/admin）一律中文 */
export const useT = () => {
  const lang = useLangStore((s) => s.lang)
  // ponytail: 直接看網址，前後台是不同路由樹、換區會重新掛載；之後後台要英文再拿掉
  const en = lang === 'en' && !window.location.pathname.startsWith('/admin')
  return <T,>(enText: T, zh: T): T => (en ? enText : zh)
}
