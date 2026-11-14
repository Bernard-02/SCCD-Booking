/**
 * 通知資料來源：Supabase public.notifications
 * RLS：本人只讀得到／改得到自己的通知。已讀狀態存資料庫（跨裝置一致）。
 */

import { supabase } from './supabase'

export interface AppNotification {
  id: string
  content: string
  timestamp: number
  read: boolean
  link: string | null   // 點了要去哪（後台通知用：/admin/orders?student=學號）
}

interface NotificationRow { id: number; message: string; is_read: boolean; created_at: string; link: string | null }
const toNotification = (row: NotificationRow): AppNotification => ({
  id: String(row.id),
  content: row.message,
  timestamp: new Date(row.created_at).getTime(),
  read: row.is_read,
  link: row.link ?? null
})

/** 讀取自己 7 天內的通知（新的在前） */
export async function fetchMyNotifications(): Promise<AppNotification[]> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, message, is_read, created_at, link')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(toNotification)
}

/** 後台通知頁：值班共用的收件匣，最高權限與學會成員看同一份（operator-access.sql） */
export async function fetchDutyNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('operator_notifications')
  if (error) throw error
  return ((data ?? []) as NotificationRow[]).map(toNotification)
}

export async function markDutyNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('operator_mark_notifications_read')
  if (error) console.error('標記通知已讀失敗:', error)
}

/** 後台通知頁點一則＝那則已讀（收件匣是值班共用的，學會成員沒有那幾列的 RLS，所以走 RPC；supabase/sa-feedback-2026-11.sql 第 5 節） */
export async function markDutyNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.rpc('operator_mark_notification_read', { p_id: Number(id) })
  if (error) console.error('標記通知已讀失敗:', error)
}

/** 將自己的通知全部標為已讀 */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
  if (error) console.error('標記通知已讀失敗:', error)
}
