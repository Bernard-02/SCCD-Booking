/**
 * 登入資料的 localStorage/sessionStorage 讀取工具（無狀態、純函式）
 * 供 AuthContext 與 bookmarkStore 共用，避免各自重複 local→session fallback + JSON.parse 樣板。
 */

import type { Student } from './authTypes'

/** 登入資料 storage key（記住我存 local，否則存 session） */
export const LOGIN_STORAGE_KEY = 'sccd_login_data'

export interface LoginData {
  student: Student
  token: string
  loginTime: number
  expiresIn: number
  rememberMe: boolean
}

/** 後台帳號的登入期限（學會共用電腦）：從登入起算、不續期。server 端同值在 supabase/admin-session-limit.sql，改的話兩邊一起改 */
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000

/** admin 看固定期限；其他人看閒置效期 expiresIn（loginTime 每次開 app 續）。這裡只負責到期登出，權限防線在 user_role() */
export const isLoginExpired = (data: LoginData, now = Date.now()): boolean =>
  now > data.loginTime + (data.student?.role === 'admin' ? ADMIN_SESSION_MS : data.expiresIn)

/**
 * 從 localStorage→sessionStorage 讀取並解析登入資料。
 * 無資料或解析失敗回傳 null（不檢查過期、不清除——過期/清除邏輯由呼叫端各自決定）。
 */
export const readLoginData = (): LoginData | null => {
  const raw = localStorage.getItem(LOGIN_STORAGE_KEY) ?? sessionStorage.getItem(LOGIN_STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LoginData
  } catch {
    return null
  }
}

/** 目前登入者的學號（未登入或無資料回傳 null） */
export const getCurrentStudentId = (): string | null =>
  readLoginData()?.student?.studentId ?? null
