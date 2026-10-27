/**
 * 後台共用 UI 語彙：狀態／種類標籤、按鈕與輸入框樣式、頁標題。
 * 用字與顏色跟前台 Profile（getStatusInfo／getBookingTypeLabel）完全一致，
 * 改狀態語彙時兩邊要一起動。
 */

import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Calendar from '../Calendar'
import { toDateKey } from '../../utils/timeUtils'
import type { OrderStatus, OrderRow } from '../../services/ordersService'

/** 品項摘要（一項一行）：設備一律標數量（含 ×1）；編號區／教室不標 */
export const itemsSummary = (o: Pick<OrderRow, 'order_items'>) =>
  o.order_items.map(i => `${i.name}${i.item_type === 'equipment' ? ` ×${i.quantity}` : ''}`).join('\n')

export const STATUS_META: Record<OrderStatus, { zh: string; color: string; textColor: string }> = {
  pending: { zh: '待銷單', color: 'var(--color-yellow)', textColor: 'black' },
  'in-progress': { zh: '使用中', color: 'var(--color-blue)', textColor: 'white' },
  overdue: { zh: '未完成歸還', color: 'var(--color-error2)', textColor: 'white' },
  returned: { zh: '已歸還', color: 'var(--color-success)', textColor: 'white' },
  canceled: { zh: '已取消', color: 'var(--color-gray-scale3)', textColor: 'white' }
}

export const BOOKING_TYPE_META: Record<string, { zh: string }> = {
  little: { zh: '小量' },
  'mass-personal': { zh: '大量 - 個人' },
  'mass-group': { zh: '大量 - 團體' }
}

/**
 * 訂單種類＝四格，送單前在購物車就決定：設備（小量／大量）、空間（個人／團體），標籤同購物車與前台日期列。
 * 分單（2026-10-02）後一張單只有設備或只有空間（submit_orders 擋混合），單內品項即可判斷類別。
 * 設備大量＝mass-personal、空間團體＝mass-group（rental-rules §1）；key 依此排序時同類相鄰。
 */
export const ORDER_KIND_META: Record<string, { zh: string }> = {
  'equipment-little': { zh: '小量設備' },
  'equipment-mass-personal': { zh: '大量設備' },
  'space-little': { zh: '個人空間' },
  'space-mass-group': { zh: '團體空間' }
}
// ponytail: 分單前的舊混合單有設備即歸「設備」（品項欄仍完整列出）；上線前清掉測試單即無此情況
export const orderKind = (o: Pick<OrderRow, 'booking_type' | 'order_items'>) =>
  `${o.order_items.some(i => i.item_type === 'equipment') ? 'equipment' : 'space'}-${o.booking_type}`
/** 四格以外的組合（舊資料）退回三種 bookingType 的標籤 */
export const orderKindMeta = (o: Pick<OrderRow, 'booking_type' | 'order_items'>) =>
  ORDER_KIND_META[orderKind(o)] ?? BOOKING_TYPE_META[o.booking_type] ?? { zh: o.booking_type }

/**
 * 大量設備已預繳押金、尚未取件：status 仍是 pending（佔用規則不變），以 deposit_paid_at 區分（mass-pickup.sql）。
 * 顯示成獨立的「待取件」標籤；前台 Profile 同一份用字與顏色（en 給前台英文版用）。
 */
export const AWAITING_PICKUP_META = { en: 'Paid', zh: '待取件', color: 'var(--color-cyan-blue)', textColor: 'black' }
export const isAwaitingPickup = (o: Pick<OrderRow, 'status' | 'deposit_paid_at'>) =>
  o.status === 'pending' && !!o.deposit_paid_at
/** 已預繳但起租日（＝取件日）已過仍未取件 → 後台提醒，學會手動處理 */
export const isPickupLate = (o: Pick<OrderRow, 'status' | 'deposit_paid_at' | 'start_date'>, todayKey: string) =>
  isAwaitingPickup(o) && o.start_date < todayKey

/** 狀態標籤（與 Profile 訂單列表的標籤同一份 markup）；awaitingPickup＝已繳押金待取件 */
export const StatusChip: React.FC<{ status: OrderStatus; awaitingPickup?: boolean }> = ({ status, awaitingPickup }) => {
  const meta = awaitingPickup ? AWAITING_PICKUP_META : STATUS_META[status]
  return (
    <span
      className="px-2.5 py-0.5 inline-flex items-center justify-center rounded-lg border border-transparent"
      style={{ backgroundColor: meta.color }}
    >
      {/* 比表格內文小一號（12px）：有底色的標籤視覺上會顯大，同字級反而搶版面 */}
      <span className="text-[0.75rem] whitespace-nowrap" style={{ color: meta.textColor }}>
        {meta.zh}
      </span>
    </span>
  )
}

/** 動作按鈕樣式（Profile 的 Extend 延期按鈕） */
export const actionBtn = (enabled = true) =>
  `px-3 py-1 inline-flex items-center justify-center border rounded-lg text-xs whitespace-nowrap ${
    enabled
      ? 'border-white text-white hover:bg-white hover:text-black cursor-pointer'
      : 'border-gray-scale3 text-gray-scale3 cursor-not-allowed'
  }`

/** 表單輸入框樣式（深色透明底＋聚焦白框） */
export const inputCls =
  'bg-transparent border border-gray-scale4 rounded-lg px-3 py-1.5 text-xs text-white focus:border-white outline-none'

// ---- 工具列（訂單／設備管理等清單頁共用，2026-10-24 定）：預設灰底白字、active（展開中／有生效篩選／選中分頁）＝白底黑字 ----
export const toolBtn = (active: boolean) =>
  `h-9 rounded-lg text-xs whitespace-nowrap cursor-pointer ${active ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/15'}`
// icon＋文字：icon 側 padding 少 4px
export const textBtn = (active: boolean) => `${toolBtn(active)} inline-flex items-center pl-2 pr-3 gap-1.5 font-chinese`
// 列內的 icon 動作鈕（修改等）：白底黑 icon 方形（同前台的白色按鈕，hover 變淡）
export const iconFillBtn = 'w-9 h-9 inline-flex items-center justify-center rounded-lg bg-white text-black hover:opacity-70 cursor-pointer'

/** iOS 式開關：on 綠底、off 灰底，白色圓鈕滑動（非 hover 動畫，可以有 transition）；busy 時半透明不可點 */
export const Switch: React.FC<{ checked: boolean; onChange: () => void; busy?: boolean; label: string }> = ({
  checked, onChange, busy, label
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    title={label}
    disabled={busy}
    onClick={onChange}
    className="relative inline-flex w-11 h-6 shrink-0 rounded-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    style={{ backgroundColor: checked ? '#34c759' : 'var(--color-gray-scale4)' }} // on＝iOS 系統綠（--color-success 太亮）
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
  </button>
)

/** 數字輸入框：原生 spinner 藏掉，右側換成自己的上下 chevron（點了 ±step，不低於 min；空字串＝min） */
export const NumberInput: React.FC<{
  value: number
  onChange: (n: number) => void
  min?: number
  step?: number
  className?: string
}> = ({ value, onChange, min = 0, step = 1, className = '' }) => {
  const clamp = (n: number) => Math.max(min, Number.isFinite(n) ? n : min)
  const stepBtn = (icon: string, delta: number, label: string) => (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      onClick={() => onChange(clamp(value + delta))}
      className="flex-1 flex items-center justify-center text-gray-scale2 hover:!text-white cursor-pointer"
    >
      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>{icon}</span>
    </button>
  )
  return (
    <span className={`relative inline-flex ${className}`}>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={e => onChange(clamp(parseInt(e.target.value, 10)))}
        className={`${inputCls} w-full pr-8 font-english appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      {/* 上下各留 3px，兩顆 14px chevron 剛好填滿 34px 高的輸入框、與邊緣等距 */}
      <span className="absolute right-1 inset-y-[3px] w-6 flex flex-col">
        {stepBtn('expand_less', step, '增加')}
        {stepBtn('expand_more', -step, '減少')}
      </span>
    </span>
  )
}

/** 搜尋框（灰底、左 search icon、Esc 清空）；清除鈕樣式在 index.css */
export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string; className?: string }> = ({
  value, onChange, placeholder = '搜尋', className = ''
}) => (
  <label className={`relative ${className}`}>
    <span
      className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-scale2"
      style={{ fontSize: '20px' }}
      aria-hidden="true"
    >search</span>
    <input
      type="search"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => { if (e.key === 'Escape') onChange('') }}
      placeholder={placeholder}
      className="h-9 w-full pl-9 pr-3 rounded-lg bg-white/10 focus:bg-white/15 text-xs text-white placeholder:text-gray-scale2 outline-none font-chinese"
    />
  </label>
)

/** 計數分頁（搜尋列上方）：選中＝白底黑字粗體、徽章黑字淡底；其餘灰底白字、徽章淡白底 */
export function CountTabs<K extends string>({ tabs, value, counts, onChange }: {
  tabs: readonly { key: K; zh: string }[]
  value: K
  counts: Partial<Record<K, number>>
  onChange: (k: K) => void
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2 mb-4">
      {tabs.map(t => {
        const active = value === t.key
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`${toolBtn(active)} pl-3 pr-2 flex items-center gap-2 font-chinese ${active ? 'font-bold' : ''}`}
          >
            {t.zh}
            <span className={`min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-lg text-2xs font-english font-normal ${
              active ? 'bg-black/10' : 'bg-white/10 opacity-70'
            }`}>
              {counts[t.key] ?? 0}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ---- 清單表格（訂單／設備管理共用）：表頭固定在捲動區頂端，無底色、有底線；bg-black 只是讓捲上來的列不透出來。
// 表格用 border-collapse: separate、分隔線畫在每個儲存格上（separate 模式 <tr> 的 border 不會畫），表頭底線也跟著 sticky 走 ----
export const tableRowLine = 'border-b border-gray-scale4'
const rowLine = tableRowLine
export const tableTh = `px-3 py-3 font-normal whitespace-nowrap sticky top-0 z-10 bg-black ${rowLine}`
export const tableTd = `px-3 py-3 whitespace-nowrap ${rowLine}`

/** 清單縮圖：沒圖或載入失敗＝灰底＋類型 icon（破圖難看） */
export const Thumb: React.FC<{ src: string | null; alt: string; icon: string }> = ({ src, alt, icon }) => {
  const [broken, setBroken] = useState(false)
  useEffect(() => { setBroken(false) }, [src])
  return src && !broken ? (
    <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className="w-10 h-10 object-cover rounded-md shrink-0" />
  ) : (
    <span className="w-10 h-10 rounded-md bg-white/10 shrink-0 flex items-center justify-center text-gray-scale2" aria-hidden="true">
      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{icon}</span>
    </span>
  )
}

// ---- 單欄排序（設備／空間管理；訂單頁有自己的多欄排序）----
export type Sort<F extends string> = { field: F; dir: 'asc' | 'desc' } | null
/** 點同一欄翻方向、點別欄改升冪 */
export const toggleSort = <F extends string>(prev: Sort<F>, field: F): Sort<F> =>
  prev?.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }
export const sortRows = <T,>(rows: T[], dir: 'asc' | 'desc', get: (r: T) => string | number | boolean): T[] =>
  [...rows].sort((a, b) => {
    const x = get(a), y = get(b)
    const c = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'zh-Hant') : Number(x) - Number(y)
    return dir === 'asc' ? c : -c
  })

/** 可排序表頭：標籤＋上下 chevron 疊成一顆（未排序兩半皆暗、排序中方向那半亮，同訂單頁） */
export function SortTh<F extends string>({ zh, field, sort, onSort, className = '' }: {
  zh: string
  field: F
  sort: Sort<F>
  onSort: (field: F) => void
  className?: string
}) {
  const active = sort?.field === field
  const asc = active && sort?.dir === 'asc'
  const desc = active && sort?.dir === 'desc'
  return (
    <th
      className={`${tableTh} ${className} cursor-pointer select-none hover:text-white`}
      onClick={() => onSort(field)}
      aria-sort={active ? (asc ? 'ascending' : 'descending') : 'none'}
    >
      {zh}
      <span className="relative inline-block w-4 h-4 ml-0.5 align-middle">
        <span className={`material-symbols-outlined absolute left-0 -top-[3px] ${asc ? '' : 'opacity-30'}`} style={{ fontSize: '16px' }}>expand_less</span>
        <span className={`material-symbols-outlined absolute left-0 top-[3px] ${desc ? '' : 'opacity-30'}`} style={{ fontSize: '16px' }}>expand_more</span>
      </span>
    </th>
  )
}

/** 選取模式控制（同購物車的「選取」）：未進入＝「選取」鈕；進入後＝已選數＋批次動作＋取消 */
export const SelectControls: React.FC<{
  mode: boolean
  count: number
  onEnter: () => void
  onExit: () => void
  actions: { zh: string; onClick: () => void }[]
}> = ({ mode, count, onEnter, onExit, actions }) => mode ? (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-scale2 font-chinese mr-1">
      已選 <span className="font-english text-white">{count}</span>
    </span>
    {actions.map(a => (
      <button
        key={a.zh}
        onClick={a.onClick}
        disabled={count === 0}
        className={`${toolBtn(false)} px-3 font-chinese disabled:opacity-40 disabled:cursor-not-allowed`}
      >
        {a.zh}
      </button>
    ))}
    <button onClick={onExit} className={textBtn(false)}>
      <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">undo</span>
      取消
    </button>
  </div>
) : (
  <button onClick={onEnter} className={textBtn(false)}>
    <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">check_box</span>
    選取
  </button>
)

/**
 * 表單對話框殼（新增／修改設備、組合等）：樣式同 OrderActionDialog／OrderInfoDialog——
 * 黑底白字 16px 圓角、標題＋內容＋底線＋右下「取消／確定」。Esc／點外面＝取消。
 */
export const FormDialog: React.FC<{
  title: string
  subtitle?: React.ReactNode
  confirmZh?: string
  busy?: boolean
  canConfirm?: boolean
  onConfirm: () => void
  onCancel: () => void
  /** 左圖右表單這類較寬的內容 */
  wide?: boolean
  children: React.ReactNode
}> = ({ title, subtitle, confirmZh = '確定', busy, canConfirm = true, onConfirm, onCancel, wide, children }) => {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])
  const ok = canConfirm && !busy
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onCancel}
    >
      <div
        className={`bg-[#151515] border border-[#545454] ${wide ? 'max-w-2xl' : 'max-w-lg'} w-full mx-4 rounded-2xl`}
        onClick={e => e.stopPropagation()}
        style={{ animation: 'fadeIn 0.2s ease-out' }}
      >
        <div className="px-6 pt-6">
          <h2 className="text-sm text-white font-normal">{title}</h2>
          {subtitle && <p className="text-xs text-gray-scale2 mt-1">{subtitle}</p>}
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">{children}</div>
        <div className="px-6"><div className="border-t border-[#545454]" /></div>
        <div className="px-6 py-4 flex justify-end gap-6 text-xs">
          <button onClick={onCancel} className="text-gray-scale2 hover:!text-white cursor-pointer">取消</button>
          <button
            onClick={() => ok && onConfirm()}
            disabled={!ok}
            className={ok ? 'text-white hover:opacity-70 cursor-pointer' : 'text-gray-scale3 cursor-not-allowed'}
          >
            {busy ? '處理中…' : confirmZh}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/** 對話框內的欄位：灰字標籤（必填加紅星）＋下方輸入元件 */
export const Field: React.FC<{ zh: string; required?: boolean; children: React.ReactNode }> = ({ zh, required, children }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs text-gray-scale2 font-chinese">
      {zh}
      {required && <span className="ml-1" style={{ color: 'var(--color-error2)' }}>*</span>}
    </span>
    {children}
  </label>
)

/**
 * 下拉選單（自訂，取代原生 <select>：原生展開的清單無法改樣式）。
 * 觸發鈕同輸入框外觀（高 36px、expand_more 箭頭）；清單圓角 8px（同按鈕，後台 2026-10-24 定）、hover／鍵盤選到出灰底、
 * 已選的打勾。清單用 portal＋fixed 定位，不會被表格等捲動容器裁掉；下方空間不夠就往上開；捲動或縮放視窗時收起。
 * 鍵盤：↑↓ 移動、Enter／空白 選取、Esc 收起（不會連帶關掉外層對話框）、Tab 收起。
 * group＝分組標題（取代 optgroup）；value 不在選項內時觸發鈕顯示 placeholder（「＋ 加人」這類動作選單即如此）。
 * searchable＝清單第一列是搜尋框（選項多的時候，如組合的「加入設備」）：展開即聚焦、打字過濾 label／group、
 * 第一個符合的自動選到（Enter 即選）；↑↓／Enter／Esc 在搜尋框裡照常，空白鍵留給輸入。
 */
export interface SelectOption<V> { value: V; label: React.ReactNode; disabled?: boolean; group?: string }

export function Select<V extends string | number>({
  value, options, onChange, placeholder = '請選擇', disabled, icon, filled, searchable, className = '', 'aria-label': ariaLabel
}: {
  value: V
  /** 顯示在選中文字左邊的 Material icon（工具列篩選用，如 category） */
  icon?: string
  /** 工具列樣式：灰底無框，展開＝白底黑字（同狀態分頁的選中膠囊）；預設是表單用的黑底灰框 */
  filled?: boolean
  /** 清單頂端放搜尋框過濾選項 */
  searchable?: boolean
  options: SelectOption<V>[]
  onChange: (value: V) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [query, setQuery] = useState('')
  const [pos, setPos] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const selected = options.find(o => o.value === value)
  // 搜尋中只列符合的（label 是字串才比得了，JSX label 的選項搜尋時一律不顯示）
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter(o => `${typeof o.label === 'string' ? o.label : ''} ${o.group ?? ''}`.toLowerCase().includes(q)) : options

  const openMenu = () => {
    const r = btnRef.current!.getBoundingClientRect()
    const groups = new Set(options.map(o => o.group).filter(Boolean)).size
    const menuH = Math.min(options.length * 36 + groups * 28 + 10 + (searchable ? 40 : 0), 320) // 320＝max-h-80
    const below = window.innerHeight - r.bottom
    setPos(below < menuH + 8 && r.top > below
      ? { left: r.left, bottom: window.innerHeight - r.top + 4, minWidth: r.width }
      : { left: r.left, top: r.bottom + 4, minWidth: r.width })
    setQuery('')
    setActive(options.findIndex(o => o.value === value && !o.disabled))
    setOpen(true)
  }

  const choose = (o: SelectOption<V>) => {
    if (o.disabled) return
    setOpen(false)
    btnRef.current?.focus()
    if (o.value !== value) onChange(o.value)
  }

  // 點外面、捲動（清單本身除外）、縮放視窗 → 收起
  useEffect(() => {
    if (!open) return
    const inside = (t: EventTarget | null) =>
      !!t && (!!menuRef.current?.contains(t as Node) || !!btnRef.current?.contains(t as Node))
    const onDown = (e: MouseEvent) => { if (!inside(e.target)) setOpen(false) }
    const onScroll = (e: Event) => { if (!menuRef.current?.contains(e.target as Node)) setOpen(false) }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  // 鍵盤移動時讓選到的項目留在清單可視範圍
  useEffect(() => {
    if (open && active >= 0) menuRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const move = (dir: 1 | -1) => {
    const n = shown.length
    const from = active < 0 ? (dir === 1 ? -1 : n) : active
    for (let k = 1; k <= n; k++) {
      const i = (((from + dir * k) % n) + n) % n
      if (!shown[i].disabled) { setActive(i); return }
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu() }
      return
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btnRef.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (shown[active]) choose(shown[active]) }
    else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        className={`relative inline-flex items-center h-9 ${icon ? 'pl-2 gap-1.5' : 'pl-3'} pr-9 rounded-lg text-xs text-left outline-none whitespace-nowrap ${
          filled
            ? open ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/15 focus-visible:bg-white/15'
            : `bg-black border text-white ${open ? 'border-white' : 'border-gray-scale4 focus-visible:border-white'}`
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      >
        {icon && <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">{icon}</span>}
        <span className={`min-w-0 truncate ${selected ? '' : 'text-gray-scale2'}`}>{selected?.label ?? placeholder}</span>
        <span
          className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70"
          style={{ fontSize: '18px' }}
          aria-hidden="true"
        >expand_more</span>
      </button>
      {open && createPortal(
        <ul
          ref={menuRef}
          id={listId}
          role="listbox"
          style={pos}
          className={`fixed z-[10000] max-h-80 overflow-y-auto p-1 ${searchable ? 'pt-0' : ''} bg-[#151515] border border-[#545454] rounded-lg text-xs`}
        >
          {searchable && (
            // sticky：清單捲動時搜尋框留在頂端。清單的上內距改由這列的 pt-1 補（清單 pt-0），列才從 0 開始、
            // 底色蓋得住捲過去的選項（sticky 用負邊距會留縫）；pb-1 與下方選項隔開。外觀同 SearchBox；空白鍵不交給 onKeyDown（那會當成選取）
            <li role="presentation" className="sticky top-0 z-10 bg-[#151515] pt-1 pb-1">
              <label className="relative block">
                <span
                  className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-scale2"
                  style={{ fontSize: '20px' }}
                  aria-hidden="true"
                >search</span>
                <input
                  type="search"
                  value={query}
                  autoFocus
                  onChange={e => { setQuery(e.target.value); setActive(0) }}
                  onKeyDown={e => { if (e.key !== ' ') onKeyDown(e) }}
                  placeholder="搜尋"
                  aria-controls={listId}
                  aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                  className="h-9 w-full pl-9 pr-3 rounded-lg bg-white/10 focus:bg-white/15 text-xs text-white placeholder:text-gray-scale2 outline-none font-chinese"
                />
              </label>
            </li>
          )}
          {searchable && shown.length === 0 && (
            <li role="presentation" className="px-3 py-2 text-gray-scale2 font-chinese">找不到符合的項目</li>
          )}
          {shown.map((o, i) => (
            <React.Fragment key={`${o.group ?? ''}-${o.value}`}>
              {o.group && o.group !== shown[i - 1]?.group && (
                <li role="presentation" className="px-3 pt-2 pb-1 text-2xs text-gray-scale3">{o.group}</li>
              )}
              <li
                id={`${listId}-${i}`}
                data-i={i}
                role="option"
                aria-selected={o.value === value}
                aria-disabled={o.disabled || undefined}
                onMouseEnter={() => !o.disabled && setActive(i)}
                onMouseDown={e => e.preventDefault()} // 不搶走觸發鈕的焦點
                onClick={() => choose(o)}
                className={`flex items-center justify-between gap-6 pl-3 pr-2 py-2 rounded-lg whitespace-nowrap ${
                  o.disabled ? 'text-gray-scale3 cursor-not-allowed' : 'text-white cursor-pointer'
                } ${i === active ? 'bg-white/10' : ''}`}
              >
                <span>{o.label}</span>
                <span
                  className={`material-symbols-outlined ${o.value === value ? '' : 'invisible'}`}
                  style={{ fontSize: '16px' }}
                  aria-hidden="true"
                >check</span>
              </li>
            </React.Fragment>
          ))}
        </ul>,
        document.body
      )}
    </>
  )
}

/**
 * 日期選擇（後台篩選用）：觸發框同 Select 觸發鈕外觀＋下拉前台同款月曆（compact 單月，往前不限、往後到本月＋2）。
 * DatePicker＝單日，選到即套用並收起；DateRangePicker＝起／迄兩個框共用一個月曆（先點起日再點迄日，同前台），
 * 選到即套用，「清除」清空、「完成」收起。值用 'YYYY-MM-DD'（區間的空字串＝不限）。
 */
const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const fmtKey = (k: string) => k.replace(/-/g, '/')
const FAR_PAST = new Date(2020, 0, 1) // 篩過去的訂單，不受前台「今天以後」的限制
const popoverCls = 'absolute left-0 right-0 top-full mt-1 z-20 p-4 bg-[#151515] border border-[#545454] rounded-lg'

// 點外面／Esc 收起（Esc 不往外傳，開在對話框裡不會連對話框一起關）
const useCloseOnOutside = (open: boolean, setOpen: (v: boolean) => void, ref: React.RefObject<HTMLElement>) => {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen, ref])
}

const DateTrigger: React.FC<{ value: string; placeholder: string; open: boolean; onClick: () => void; className?: string }> = ({
  value, placeholder, open, onClick, className = ''
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-haspopup="dialog"
    aria-expanded={open}
    className={`relative inline-flex items-center h-9 pl-3 pr-9 rounded-lg text-xs text-left outline-none cursor-pointer ${
      open ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/15 focus-visible:bg-white/15'
    } ${className}`}
  >
    <span className={value ? 'font-english' : 'text-gray-scale2 font-chinese'}>{value ? fmtKey(value) : placeholder}</span>
    <span
      className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70"
      style={{ fontSize: '18px' }}
      aria-hidden="true"
    >date_range</span>
  </button>
)

export const DatePicker: React.FC<{ value: string; onChange: (v: string) => void; className?: string }> = ({
  value, onChange, className = ''
}) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useCloseOnOutside(open, setOpen, ref)
  const d = value ? parseKey(value) : null
  // 兩顆按鈕（同後台工具列：灰底無框、hover 稍亮；展開中＝白底黑字）：左＝月曆 icon、右＝日期；點哪顆都開同一個月曆
  const btnCls = `h-9 inline-flex items-center rounded-lg text-xs outline-none cursor-pointer ${
    open ? 'bg-white text-black' : 'bg-white/10 text-white hover:bg-white/15'
  }`
  const toggle = () => setOpen(v => !v)
  return (
    <div ref={ref} className={`relative flex items-center gap-2 ${className}`}>
      <button type="button" onClick={toggle} aria-label="選擇日期" aria-haspopup="dialog" aria-expanded={open} className={`${btnCls} w-9 justify-center`}>
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }} aria-hidden="true">date_range</span>
      </button>
      <button type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open} className={`${btnCls} flex-1 px-3 text-left ${value ? 'font-english' : 'font-chinese'}`}>
        {value ? fmtKey(value) : '選擇日期'}
      </button>
      {open && (
        <div role="dialog" className={popoverCls}>
          {/* 起迄傳同一天＝單日選取；月曆在「已有完整區間」時點任一天會回傳新起日，拿它當選到的日期 */}
          <Calendar
            isMobile
            variant="compact"
            startDate={d}
            endDate={d}
            onDateSelect={s => { if (s) { onChange(toDateKey(s)); setOpen(false) } }}
            minSelectableDate={FAR_PAST}
            maxDays={36500}
          />
        </div>
      )}
    </div>
  )
}

export const DateRangePicker: React.FC<{
  from: string
  to: string
  onChange: (r: { from: string; to: string }) => void
}> = ({ from, to, onChange }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useCloseOnOutside(open, setOpen, ref)
  const toggle = () => setOpen(v => !v)
  return (
    <div ref={ref} className="relative inline-flex items-center gap-2">
      <DateTrigger value={from} placeholder="開始" open={open} onClick={toggle} className="w-36" />
      <span className="text-gray-scale3">–</span>
      <DateTrigger value={to} placeholder="結束" open={open} onClick={toggle} className="w-36" />
      {open && (
        <div role="dialog" className={popoverCls}>
          <Calendar
            isMobile
            variant="compact"
            startDate={from ? parseKey(from) : null}
            endDate={to ? parseKey(to) : null}
            onDateSelect={(s, e) => onChange({ from: s ? toDateKey(s) : '', to: e ? toDateKey(e) : '' })}
            minSelectableDate={FAR_PAST}
            maxDays={36500}
          />
          <div className="mt-3 flex justify-end gap-6 text-xs font-chinese">
            <button
              onClick={() => onChange({ from: '', to: '' })}
              className="text-gray-scale2 hover:!text-white cursor-pointer"
            >清除</button>
            <button onClick={() => setOpen(false)} className="text-white hover:opacity-70 cursor-pointer">完成</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** 後台圖片只收 JPG／PNG（uploadImage 也擋） */
const IMAGE_ACCEPT = 'image/jpeg,image/png'

/**
 * 可換圖的縮圖：點擊開檔案選擇（原生 label＋file input，鍵盤可聚焦），hover 整張蓋相機 icon。
 * src＝null 表示還沒有圖（新增設備）：畫虛線框 placeholder（上傳 icon＋支援格式）。
 * size＝邊長 px（預設 40，清單用）；caption＝圖下方與圖等寬的灰底按鈕（左相機 icon＋文字，對話框用），點鈕同樣開檔案選擇。
 */
export const ImagePicker: React.FC<{
  src: string | null; alt: string; busy?: boolean; onPick: (file: File) => void; size?: number; caption?: string
}> = ({ src, alt, busy, onPick, size = 40, caption }) => {
  const big = size > 40
  const radius = big ? 'rounded-xl' : 'rounded-md'
  return (
    <label
      title={src ? '更換圖片' : '選擇圖片'}
      className={`group flex flex-col gap-3 cursor-pointer ${busy ? 'opacity-40 pointer-events-none' : ''}`}
      style={{ width: size }}
    >
      <span className={`relative block ${radius} focus-within:ring-1 focus-within:ring-white`} style={{ height: size }}>
        {src ? (
          <>
            <img src={src} alt={alt} loading="lazy" className={`w-full h-full object-cover ${radius}`} />
            <span className={`absolute inset-0 flex items-center justify-center ${radius} bg-black/60 opacity-0 group-hover:opacity-100`}>
              <span className="material-symbols-outlined text-white" style={{ fontSize: big ? '28px' : '18px' }}>photo_camera</span>
            </span>
          </>
        ) : (
          <span className={`w-full h-full flex flex-col items-center justify-center gap-2 ${radius} border border-dashed border-gray-scale3 bg-white/5 text-gray-scale2 group-hover:!text-white group-hover:border-white`}>
            <span className="material-symbols-outlined" style={{ fontSize: big ? '28px' : '18px' }}>upload</span>
            {big && <span className="text-2xs font-english">JPG / PNG, 5MB</span>}
          </span>
        )}
      </span>
      {caption && (
        <span className={`${textBtn(false)} w-full justify-center group-hover:bg-white/15`}>
          <span className="material-symbols-outlined opacity-70" style={{ fontSize: '18px' }} aria-hidden="true">photo_camera</span>
          {caption}
        </span>
      )}
      <input
      type="file"
      accept={IMAGE_ACCEPT}
      className="sr-only"
      onChange={e => {
        const file = e.target.files?.[0]
        e.target.value = '' // 清空：同一檔案再選一次也會觸發
        if (file) onPick(file)
      }}
    />
    </label>
  )
}

/**
 * 分頁狀態：resetKey（搜尋／篩選／排序）或每頁筆數變動回第一頁；
 * 資料重新載入不回（操作完留在原頁），筆數變少時夾回最後一頁
 */
export function usePager<T>(rows: T[], resetKey: unknown[]) {
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(0)
  useEffect(() => setPage(0), [...resetKey, pageSize])
  const cur = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1))
  return {
    pageRows: rows.slice(cur * pageSize, (cur + 1) * pageSize),
    pager: { total: rows.length, page: cur, pageSize, onPage: setPage, onPageSize: setPageSize }
  }
}

const pagerBtn =
  'w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-gray-scale2 enabled:hover:!text-white enabled:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed'

/** 分頁列：左＝目前區間與總數、中＝上下頁＋頁碼（最多 5 個，目前頁盡量置中）、右＝每頁筆數；0 筆不顯示 */
export const Pager: React.FC<ReturnType<typeof usePager>['pager']> = ({ total, page, pageSize, onPage, onPageSize }) => {
  if (total === 0) return null
  const pages = Math.ceil(total / pageSize)
  const first = Math.max(0, Math.min(page - 2, pages - 5))
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => first + i)
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mt-4 text-xs text-gray-scale2 font-chinese">
      <span>
        顯示 <span className="font-english">{page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)}</span>，共{' '}
        <span className="font-english">{total}</span> 筆
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 0} className={pagerBtn} aria-label="上一頁">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
        </button>
        {nums.map(n => (
          <button
            key={n}
            onClick={() => onPage(n)}
            aria-current={n === page ? 'page' : undefined}
            className={`${n === page ? 'w-9 h-9 flex items-center justify-center rounded-lg text-white bg-white/10' : pagerBtn} font-english`}
          >
            {n + 1}
          </button>
        ))}
        <button onClick={() => onPage(page + 1)} disabled={page + 1 >= pages} className={pagerBtn} aria-label="下一頁">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
        </button>
      </div>
      <label className="flex items-center gap-2 justify-self-end">
        每頁顯示
        <Select value={pageSize} onChange={onPageSize} options={[10, 25, 50, 100].map(n => ({ value: n, label: n }))} className="font-english" />
        筆
      </label>
    </div>
  )
}

/**
 * 載入失敗：顯示原因＋重試。不能讓失敗看起來像「沒有資料」——
 * 值班的人可能以為資料不見而重複新增。
 */
export const LoadError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="py-16 flex flex-col items-center gap-4 text-xs font-chinese">
    <p style={{ color: 'var(--color-error2)' }}>讀取失敗：{message}</p>
    <button onClick={onRetry} className={actionBtn(true)}>重試</button>
  </div>
)

/** 頁標題（＋選填說明列；children 靠右對齊，如訂單頁的更新時間） */
// sticky：內容區（AdminLayout main，自己捲動）捲動時標題固定，位置不跳。
// -mt-10/pt-10 吃掉 main 的上邊距，黑底蓋到視窗頂；mb-8 改 pb-8 讓黑底蓋住下方間距，內容從標題底下捲過去。
// top 必須是 -2.5rem 不是 0：sticky 在有 padding 的捲動容器裡是從 padding 內緣算，top-0 會被往下推 2.5rem、蓋到下方內容
export const PageTitle: React.FC<{ zh: string; desc?: string; children?: React.ReactNode }> = ({ zh, desc, children }) => (
  <div className="sticky -top-10 z-10 -mt-10 pt-10 pb-8 bg-black">
    <div className="flex items-center gap-3">
      <h1 className="text-lg text-white mr-auto">{zh}</h1>
      {children}
    </div>
    {desc && <p className="mt-1 text-xs text-gray-scale2 font-chinese">{desc}</p>}
  </div>
)
