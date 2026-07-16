/**
 * 後台共用 UI 語彙：狀態／種類標籤、按鈕與輸入框樣式、頁標題。
 * 用字與顏色跟前台 Profile（getStatusInfo／getBookingTypeLabel）完全一致，
 * 改狀態語彙時兩邊要一起動。
 */

import React from 'react'
import type { OrderStatus } from '../../services/ordersService'

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

/** 狀態標籤（與 Profile 訂單列表的標籤同一份 markup） */
export const StatusChip: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const meta = STATUS_META[status]
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
  `px-3 py-1 inline-flex items-center justify-center border rounded-lg text-tiny whitespace-nowrap transition-colors ${
    enabled
      ? 'border-white text-white hover:bg-white hover:text-black cursor-pointer'
      : 'border-gray-scale3 text-gray-scale3 cursor-not-allowed'
  }`

/** 表單輸入框樣式（深色透明底＋聚焦白框） */
export const inputCls =
  'bg-transparent border border-gray-scale4 rounded-lg px-3 py-1.5 text-tiny text-white focus:border-white outline-none'

/** 頁標題：中英同大小、同為白色（＋選填說明列） */
export const PageTitle: React.FC<{ en: string; zh: string; desc?: string }> = ({ en, zh, desc }) => (
  <div className="mb-8">
    <h1 className="text-medium-title text-white">
      <span className="font-english">{en}</span> <span className="font-chinese">{zh}</span>
    </h1>
    {desc && <p className="mt-1 text-tiny text-gray-scale2 font-chinese">{desc}</p>}
  </div>
)
