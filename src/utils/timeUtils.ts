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
export const toDateKey = (d: Date): string => {
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

/**
 * 有效歸還期限：歸還日 19:00（系學會最後營業時間）；
 * 歸還日撞週末／臨時公休則順延到下一個營業日。超過即逾期（19:01 起算）。
 * 資料庫端同邏輯在 auto-overdue.sql 的 next_business_day。
 */
export const effectiveReturnDeadline = (
  endDate: string,
  closedDates: ReadonlySet<string>
): Date => {
  const d = new Date(endDate)
  d.setHours(0, 0, 0, 0)
  while (isOffDay(d, closedDates)) d.setDate(d.getDate() + 1)
  d.setHours(19, 0, 0, 0)
  return d
}

/**
 * 逾期營業日天數（0 = 未逾期）：從有效期限的隔日起算，假日不計——
 * 與官方規則一致（罰款翻倍與滿 6 日停權都用這個天數）。
 * 資料庫端同邏輯在 account-suspension.sql 的 overdue_business_days。
 */
export const overdueBusinessDays = (
  endDate: string,
  closedDates: ReadonlySet<string>,
  now: Date = new Date()
): number => {
  const deadline = effectiveReturnDeadline(endDate, closedDates)
  if (now <= deadline) return 0

  let days = 0
  const day = new Date(deadline)
  day.setHours(0, 0, 0, 0)
  day.setDate(day.getDate() + 1)
  while (day <= now && days < 20) { // 滿 6 天已停權、罰款已達上限，不再往下數
    if (!isOffDay(day, closedDates)) days++
    day.setDate(day.getDate() + 1)
  }
  return days
}

/**
 * 延期須在原歸還日前三天（含）提出（rental-rules §11）：今天 ≤ 歸還日 − 3 天。
 * 過期限即不可延；伺服器端 extend_my_order 亦有同一道防線，前端此判斷是 UX。
 */
export const isWithinExtendWindow = (endDate: string, now: Date = new Date()): boolean => {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const deadline = new Date(endDate)
  deadline.setHours(0, 0, 0, 0)
  deadline.setDate(deadline.getDate() - 3)
  return today <= deadline
}

/**
 * 幹部值班判定：now 落在任一時段內（weekday 同 JS getDay，時間為 'HH:MM[:SS]' 字串）。
 * 經手人選單用：值班中的幹部排最前，其餘照列（代班仍可選）。
 */
export interface DutySlot { weekday: number; start_time: string; end_time: string }
export const isOnDuty = (duties: readonly DutySlot[], now: Date = new Date()): boolean => {
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  return duties.some(
    d => d.weekday === now.getDay() && hhmm >= d.start_time.slice(0, 5) && hhmm < d.end_time.slice(0, 5)
  )
}

/** 滿 6 個逾期營業日 = 未完成清潔歸還 → 停權 */
export const SUSPENSION_OVERDUE_DAYS = 6

/**
 * 逾期累計罰款：第 1 日 100 元、每日翻倍累計（100+200+400…），上限為押金總額。
 * 此為顯示用試算，最終金額由後台於歸還時確認寫入 orders.penalty_total。
 */
export const overduePenalty = (
  endDate: string,
  depositTotal: number,
  closedDates: ReadonlySet<string>,
  now: Date = new Date()
): number => {
  const days = overdueBusinessDays(endDate, closedDates, now)
  if (days <= 0) return 0
  return Math.min(100 * (2 ** days - 1), depositTotal)
}
