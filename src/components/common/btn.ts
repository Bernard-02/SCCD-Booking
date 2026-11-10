/**
 * 按鈕狀態共用 class。總原則（2026-11-10）：hover＝它的 active 狀態（灰底鈕 BTN_INVERT、線框 BTN_OUTLINE、選單 navItemCls）；
 * BTN 的 hover 整顆 50% 只給本身沒有 active 狀態的鈕（CTA、純 icon 鈕）。停用一律整顆 20%（從 100% 調，不分字色底色）；
 * 不加 transition（CLAUDE.md）。hover 用 enabled: 所以停用時不作用；<a> 沒有 :enabled，連結直接寫 hover:opacity-50。
 * aria-disabled（仍可點、點了跳提示）的鈕沒有 :disabled，自己寫 'opacity-20 cursor-not-allowed'（見 EquipmentGrid 加入清單）。
 */
export const BTN = 'cursor-pointer enabled:hover:opacity-50 disabled:cursor-not-allowed disabled:opacity-20'
/** icon 鈕的觸控面積：24px icon 撐到 44px、負邊距抵銷，版面不變（CLAUDE.md RWD 標準：可點目標最小 44×44）。 */
export const TAP = 'p-2.5 -m-2.5'
/** 灰底鈕（工具鈕、filled 下拉、日期鈕、分頁膠囊，2026-11-09 定）：hover 直接顯示 active 的樣子＝白底黑字；只有沒有 active 狀態的 CTA 才用 BTN 的 50%。
 *  停用同 BTN 20%。span／label 沒有 :enabled，自己寫 group-hover:bg-white group-hover:text-black。 */
export const BTN_INVERT = 'cursor-pointer enabled:hover:bg-white enabled:hover:text-black disabled:cursor-not-allowed disabled:opacity-20'
/** 線框鈕（2026-11-02 定）：白線白字，hover 反白＝白底黑字（借「選中」的白底黑字語彙，所以只給動作型——點交／延期／新增／− ＋；
 *  toggle 的白底已代表選中，不用這個）；整顆變淡會像快停用。停用同 BTN 20%。<a> 沒有 :enabled，連結自己寫 hover:bg-white hover:text-black。 */
export const BTN_OUTLINE = `border border-white text-white ${BTN_INVERT}`
/** 工具鈕（全選／清除／選取這類 icon＋文字的操作鈕，2026-10-31 定灰底 chip，底色 gray-dark）：接 BTN_INVERT 用；沒 icon 時另加 !pl-3。 */
export const BTN_TOOL = 'h-9 pl-2 pr-3 rounded-lg bg-gray-dark flex items-center gap-1 text-sm font-normal whitespace-nowrap text-white'
/** chip／標籤共用 class（2026-11-01 收斂，前後台同）：24px 高、12px 字、左右 10px、圓角 8px（CLAUDE.md 圓角三級）。
 *  底色與字色各處自己給（有色底黑字、gray-dark 底白字）；前面有 icon 的加 `!pl-1.5 gap-1`（icon 側少 4px）。 */
export const CHIP = 'inline-flex items-center align-middle h-6 px-2.5 rounded-lg text-2xs whitespace-nowrap'
