/**
 * 後台共用 UI 語彙：狀態／種類標籤、按鈕與輸入框樣式、頁標題。
 * 用字與顏色跟前台 Profile（getStatusInfo／getBookingTypeLabel）完全一致，
 * 改狀態語彙時兩邊要一起動。
 */

import React, { useEffect, useState } from 'react'
import type { OrderStatus, OrderRow } from '../../services/ordersService'

/** 品項摘要（一項一行）：設備一律標數量（含 ×1）；編號區／教室不標 */
export const itemsSummary = (o: Pick<OrderRow, 'order_items'>) =>
  o.order_items.map(i => `${i.name}${i.item_type === 'equipment' ? ` ×${i.quantity}` : ''}`).join('\n')

export const STATUS_ORDER: OrderStatus[] = ['pending', 'in-progress', 'overdue', 'returned', 'canceled']

export const STATUS_META: Record<OrderStatus, { en: string; zh: string; color: string; textColor: string }> = {
  pending: { en: 'Pending', zh: '待銷單', color: 'var(--color-yellow)', textColor: 'black' },
  'in-progress': { en: 'In Progress', zh: '使用中', color: 'var(--color-blue)', textColor: 'white' },
  overdue: { en: 'Overdue', zh: '未完成歸還', color: 'var(--color-error2)', textColor: 'white' },
  returned: { en: 'Returned', zh: '已歸還', color: 'var(--color-success)', textColor: 'white' },
  canceled: { en: 'Canceled', zh: '已取消', color: 'var(--color-gray-scale3)', textColor: 'white' }
}

export const BOOKING_TYPE_META: Record<string, { en: string; zh: string }> = {
  little: { en: 'Light', zh: '小量' },
  'mass-personal': { en: 'Mass - Personal', zh: '大量 - 個人' },
  'mass-group': { en: 'Mass - Group', zh: '大量 - 團體' }
}

/**
 * 訂單種類＝四格，送單前在購物車就決定：設備（小量／大量）、空間（個人／團體），標籤同購物車與前台日期列。
 * 分單（2026-10-02）後一張單只有設備或只有空間（submit_orders 擋混合），單內品項即可判斷類別。
 * 設備大量＝mass-personal、空間團體＝mass-group（rental-rules §1）；key 依此排序時同類相鄰。
 */
export const ORDER_KIND_META: Record<string, { en: string; zh: string }> = {
  'equipment-little': { en: 'Light Equipment', zh: '小量設備' },
  'equipment-mass-personal': { en: 'Mass Equipment', zh: '大量設備' },
  'space-little': { en: 'Personal Space', zh: '個人空間' },
  'space-mass-group': { en: 'Group Space', zh: '團體空間' }
}
// ponytail: 分單前的舊混合單有設備即歸「設備」（品項欄仍完整列出）；上線前清掉測試單即無此情況
export const orderKind = (o: Pick<OrderRow, 'booking_type' | 'order_items'>) =>
  `${o.order_items.some(i => i.item_type === 'equipment') ? 'equipment' : 'space'}-${o.booking_type}`
/** 四格以外的組合（舊資料）退回三種 bookingType 的標籤 */
export const orderKindMeta = (o: Pick<OrderRow, 'booking_type' | 'order_items'>) =>
  ORDER_KIND_META[orderKind(o)] ?? BOOKING_TYPE_META[o.booking_type] ?? { en: o.booking_type, zh: o.booking_type }

/**
 * 大量設備已預繳押金、尚未取件：status 仍是 pending（佔用規則不變），以 deposit_paid_at 區分（mass-pickup.sql）。
 * 顯示成獨立的「Paid 待取件」標籤；前台 Profile 同一份用字與顏色。
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
      <span className="font-english text-[0.75rem] whitespace-nowrap" style={{ color: meta.textColor }}>
        {meta.en} <span className="font-chinese">{meta.zh}</span>
      </span>
    </span>
  )
}

/** 動作按鈕樣式（Profile 的 Extend 延期按鈕） */
export const actionBtn = (enabled = true) =>
  `px-3 py-1 inline-flex items-center justify-center border rounded-lg text-xs whitespace-nowrap transition-colors ${
    enabled
      ? 'border-white text-white hover:bg-white hover:text-black cursor-pointer'
      : 'border-gray-scale3 text-gray-scale3 cursor-not-allowed'
  }`

/** 表單輸入框樣式（深色透明底＋聚焦白框） */
export const inputCls =
  'bg-transparent border border-gray-scale4 rounded-lg px-3 py-1.5 text-xs text-white focus:border-white outline-none'

/**
 * 清單排版：沿用前台 EquipmentGrid／ClassroomList——CSS grid 固定欄寬＋gap-6、
 * 表頭英上中下、列垂直置中、分隔線 #7c7c7c。欄寬（grid-cols-[…]）由各頁自帶。
 */
export const listHeadCls = 'grid gap-6 pb-3 border-b border-[#7c7c7c]'
export const listRowCls = 'grid gap-6 py-3 border-b border-[#7c7c7c] items-center'

export const HeadCell: React.FC<{ en: string; zh: string; center?: boolean }> = ({ en, zh, center }) => (
  <div className={`text-xs text-gray-scale2 ${center ? 'text-center' : ''}`}>
    <div className="font-english">{en}</div>
    <div className="font-chinese">{zh}</div>
  </div>
)

/** 可換圖的縮圖：點擊開檔案選擇（原生 label＋file input，鍵盤可聚焦），hover 顯示相機 icon */
export const ImagePicker: React.FC<{ src: string; alt: string; busy?: boolean; onPick: (file: File) => void }> = ({
  src, alt, busy, onPick
}) => (
  <label
    title="更換圖片"
    className={`group relative block w-[40px] h-[40px] rounded-md cursor-pointer focus-within:ring-1 focus-within:ring-white ${
      busy ? 'opacity-40 pointer-events-none' : ''
    }`}
  >
    <img src={src} alt={alt} loading="lazy" className="w-full h-full object-cover rounded-md" />
    <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
      <span className="material-symbols-outlined text-white" style={{ fontSize: '18px' }}>photo_camera</span>
    </span>
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="sr-only"
      onChange={e => {
        const file = e.target.files?.[0]
        e.target.value = '' // 清空：同一檔案再選一次也會觸發
        if (file) onPick(file)
      }}
    />
  </label>
)

/** 編輯鈕：鉛筆 icon（同前台 Profile 的編輯），文字說明放 title／aria-label */
export const EditIconBtn: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = '編輯 Edit' }) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className="flex items-center text-white hover:opacity-70 transition-opacity cursor-pointer"
  >
    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>edit</span>
  </button>
)

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
  'w-9 h-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-gray-scale2 hover:!text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none'

/** 分頁列（右下角，一般 database 式）：每頁筆數＋目前區間＋上下頁；0 筆不顯示 */
export const Pager: React.FC<ReturnType<typeof usePager>['pager']> = ({ total, page, pageSize, onPage, onPageSize }) =>
  total === 0 ? null : (
    <div className="flex items-center justify-end gap-4 mt-4 text-xs text-gray-scale2">
      <label className="flex items-center gap-2">
        <span><span className="font-english">Rows</span> <span className="font-chinese">每頁</span></span>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          className="bg-black border border-gray-scale4 rounded-lg px-3 py-1.5 text-xs text-white focus:border-white outline-none font-english cursor-pointer"
        >
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <span className="font-english">
        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} / {total}
      </span>
      <div className="flex items-center">
        <button onClick={() => onPage(page - 1)} disabled={page === 0} className={pagerBtn} aria-label="上一頁">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_left</span>
        </button>
        <button onClick={() => onPage(page + 1)} disabled={(page + 1) * pageSize >= total} className={pagerBtn} aria-label="下一頁">
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>chevron_right</span>
        </button>
      </div>
    </div>
  )

/**
 * 載入失敗：顯示原因＋重試。不能讓失敗看起來像「沒有資料」——
 * 值班的人可能以為資料不見而重複新增。
 */
export const LoadError: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="py-16 flex flex-col items-center gap-4 text-xs font-chinese">
    <p style={{ color: 'var(--color-error2)' }}>讀取失敗：{message}</p>
    <button onClick={onRetry} className={actionBtn(true)}>
      <span className="font-english">Retry <span className="font-chinese">重試</span></span>
    </button>
  </div>
)

/** 頁標題：中英同大小、同為白色（＋選填說明列） */
// sticky：視窗捲動時標題固定在頂端。-mt-10 pt-10 吃掉 AdminLayout main 的 py-10（固定時仍與側欄
// 「SCCD Admin」同高、未捲動時版面不變）；mb-8 改 pb-8 讓黑底蓋住下方間距，內容從標題底下捲過去
export const PageTitle: React.FC<{ en: string; zh: string; desc?: string }> = ({ en, zh, desc }) => (
  <div className="sticky top-0 z-10 -mt-10 pt-10 pb-8 bg-black">
    <h1 className="text-lg text-white">
      <span className="font-english">{en}</span> <span className="font-chinese">{zh}</span>
    </h1>
    {desc && <p className="mt-1 text-xs text-gray-scale2 font-chinese">{desc}</p>}
  </div>
)
