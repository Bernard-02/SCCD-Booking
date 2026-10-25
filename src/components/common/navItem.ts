/**
 * 左側選單項目樣式（Profile／空間／設備頁、InfoDialog、後台側欄共用）：icon＋文字膠囊，選中白底黑字，hover 灰底（同後台工具列的 bg-white/10）。
 * icon 在左，左 padding 少 4px（CLAUDE.md 規則）；沒有 icon 時左右等距。
 */
export const NAV_ITEM =
  'flex items-center gap-2 py-2 rounded-lg text-sm font-semibold cursor-pointer text-left'

export const navItemCls = (active: boolean, hasIcon = true) =>
  `${NAV_ITEM} ${hasIcon ? 'pl-3 pr-4' : 'px-4'} ${active ? 'bg-white text-black' : 'text-gray-scale2 hover:!text-white hover:bg-white/10'}`
