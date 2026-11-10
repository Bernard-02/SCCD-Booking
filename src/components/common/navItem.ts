/**
 * 左側選單項目樣式（Profile／空間／設備頁、InfoDialog、後台側欄共用）：icon＋文字膠囊，選中白底黑字。
 * hover＝選中的樣子（2026-11-10 定，同 BTN_INVERT）：未選中 hover 直接白底黑字；選中的 hover 不變。
 * NAV_HOVER（白字＋gray-dark 底）給選中是 gray-dark 底的次層項目（空間頁編號區子分類）。
 * icon 在左，左 padding 少 4px（CLAUDE.md 規則）；沒有 icon 時左右等距。
 */
export const NAV_ITEM =
  'flex items-center gap-2 py-2 rounded-lg text-sm font-semibold cursor-pointer text-left'

export const NAV_HOVER = 'hover:text-white hover:bg-gray-dark'

export const navItemCls = (active: boolean, hasIcon = true) =>
  `${NAV_ITEM} ${hasIcon ? 'pl-3 pr-4' : 'px-4'} ${active ? 'bg-white text-black' : 'text-gray-light hover:bg-white hover:text-black'}`
