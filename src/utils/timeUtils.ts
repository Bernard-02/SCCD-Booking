/**
 * 時間計算工具
 * 公休日 = 週六日 ＋ closed_dates 資料表的臨時公休日（由 fetchClosedDates 取得）
 * 「24 工作時未繳押金 → 已取消」的權威判定在資料庫端
 * （supabase/auto-cancel.sql 的 business_hours_since ＋ pg_cron），
 * 這裡是同邏輯的顯示用版本，讓排程掃描間隔內的 UI 也即時正確。
 */

import type { OrderStatus } from '../services/ordersService'

/** 繳押金期限：24 工作時 */
export const PENDING_LIMIT_MS = 24 * 60 * 60 * 1000

// 本地日期 → 'YYYY-MM-DD'（與 closed_dates.day 對齊）
const toDateKey = (d: Date): string => {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dd}`
}

/** 是否為公休日（週六日或臨時公休） */
export const isOffDay = (date: Date, closedDates: ReadonlySet<string>): boolean => {
  const day = date.getDay()
  return day === 0 || day === 6 || closedDates.has(toDateKey(date))
}

/** 兩個時間點之間的有效毫秒數：總時長扣掉公休日與區間重疊的部分 */
export const businessMsBetween = (
  start: Date,
  end: Date,
  closedDates: ReadonlySet<string>
): number => {
  if (start >= end) return 0

  let totalMs = end.getTime() - start.getTime()
  const day = new Date(start)
  day.setHours(0, 0, 0, 0)

  while (day < end) {
    if (isOffDay(day, closedDates)) {
      const dayEnd = new Date(day)
      dayEnd.setDate(dayEnd.getDate() + 1)
      const from = Math.max(day.getTime(), start.getTime())
      const to = Math.min(dayEnd.getTime(), end.getTime())
      if (to > from) totalMs -= to - from
    }
    day.setDate(day.getDate() + 1)
  }

  return totalMs
}

/** 繳押金剩餘毫秒數（負值 = 已逾時） */
export const pendingMsRemaining = (
  createdAt: string,
  now: Date,
  closedDates: ReadonlySet<string>
): number => PENDING_LIMIT_MS - businessMsBetween(new Date(createdAt), now, closedDates)

/**
 * 訂單顯示狀態：資料庫 status 為準；
 * 僅 pending 額外做逾時判定（cron 尚未掃到前先顯示已取消）。
 */
export const displayOrderStatus = (
  status: OrderStatus | undefined,
  createdAt: string,
  closedDates: ReadonlySet<string>,
  now: Date = new Date()
): OrderStatus => {
  if (status && status !== 'pending') return status
  return pendingMsRemaining(createdAt, now, closedDates) <= 0 ? 'canceled' : 'pending'
}
