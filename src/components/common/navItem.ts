/**
 * 左側選單項目樣式（Profile／空間／設備頁、InfoDialog、後台側欄共用）：icon＋文字膠囊，選中白底黑字。
 * hover（2026-10-31 定，前後台同）：未選中字變白＋gray-dark 底（NAV_HOVER，多選型不走 btn.ts 的 50% 透明）；選中的 hover 不變。
 * icon 在左，左 padding 少 4px（CLAUDE.md 規則）；沒有 icon 時左右等距。
 */
export const NAV_ITEM =
  'flex items-center gap-2 py-2 rounded-lg text-sm font-semibold cursor-pointer text-left'

export const NAV_HOVER = 'hover:text-white hover:bg-gray-dark'

export const navItemCls = (active: boolean, hasIcon = true) =>
  `${NAV_ITEM} ${hasIcon ? 'pl-3 pr-4' : 'px-4'} ${active ? 'bg-white text-black' : `text-gray-light ${NAV_HOVER}`}`
