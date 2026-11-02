/**
 * 介面語言 Store（前台 中／EN 切換；後台只有中文）
 * 選擇存在 localStorage `sccd_lang`，預設中文。
 * 中英文字各自維護（2026-10-23 起提示文字也全部中英兩版）：元件用 useT、元件外用 tr；
 * server 錯誤原因在 SQL 維持中文，前端以 utils/serverErrors.ts 對照成英文。
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

// <html lang> 跟著切換（讀屏、字型 fallback、index.css 的 EN 模式全域英文字距）；後台 AdminLayout 會改成 zh-TW
export const syncHtmlLang = (lang: Lang) => {
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-TW'
}
syncHtmlLang(useLangStore.getState().lang)
useLangStore.subscribe((s) => syncHtmlLang(s.lang))

// ponytail: 直接看網址，前後台是不同路由樹、換區會重新掛載；之後後台要英文再拿掉
const isEn = (lang: Lang) => lang === 'en' && !window.location.pathname.startsWith('/admin')

/** 依目前語言二選一：t('Login', '登入')，也可傳 JSX；後台（/admin）一律中文 */
export const useT = () => {
  const lang = useLangStore((s) => s.lang)
  const en = isEn(lang)
  return <T,>(enText: T, zh: T): T => (en ? enText : zh)
}

/**
 * 非 hook 版（hook 外、service、事件裡組訊息用）：讀「當下」語言，不會隨切換重繪——
 * 只拿來產生 Toast／錯誤訊息這類一次性文字，畫面上常駐的字用 useT
 */
export const tr = <T,>(enText: T, zh: T): T => (isEn(useLangStore.getState().lang) ? enText : zh)
