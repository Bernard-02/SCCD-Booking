/**
 * 依使用者學號組出的 localStorage key（集中 `|| 'guest'` fallback，避免散落各處的字串插值）
 */

const orGuest = (studentId?: string | null) => studentId || 'guest'

/** 訂單收據：booking_receipts_<學號|guest> */
export const receiptsKey = (studentId?: string | null) => `booking_receipts_${orGuest(studentId)}`

/** 通知：sccd_notifications_<學號|guest> */
export const notificationsKey = (studentId?: string | null) => `sccd_notifications_${orGuest(studentId)}`

/** 已讀通知：sccd_read_notifications_<學號|guest> */
export const readNotificationsKey = (studentId?: string | null) =>
  `sccd_read_notifications_${orGuest(studentId)}`
