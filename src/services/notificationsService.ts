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
}

/** 讀取自己 7 天內的通知（新的在前） */
export async function fetchMyNotifications(): Promise<AppNotification[]> {
  const since = new Date(Date.now() - 7 * 86400000).toISOString()
  const { data, error } = await supabase
    .from('notifications')
    .select('id, message, is_read, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map(row => ({
    id: String(row.id),
    content: row.message,
    timestamp: new Date(row.created_at).getTime(),
    read: row.is_read
  }))
}

/** 將自己的通知全部標為已讀 */
export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
  if (error) console.error('標記通知已讀失敗:', error)
}
