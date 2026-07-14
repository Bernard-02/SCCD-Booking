/**
 * Supabase 認證服務
 * 登入流程：學號 → email（RPC email_for_student）→ Supabase Auth 驗證 → 撈 students profile。
 * 取代已移除的 mock 登入（原 utils/testAuthData）。
 */

import { supabase } from './supabase'
import type { Student, LoginResult } from '../utils/authTypes'

// 沿用原本 app 的 7 天登入效期（app 自己的 storage 週期，與 Supabase session 無關）
const EXPIRES_IN = 7 * 24 * 60 * 60 * 1000

interface StudentRow {
  id: string
  student_id: string
  name: string
  email: string
  grade: string | null
  role: 'student' | 'admin' | 'staff'
  account_level: number
  overdue_days: number
  phone: string | null
  class_name: string | null
  created_at: string
}

const toStudent = (row: StudentRow): Student => ({
  studentId: row.student_id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  department: '媒體傳達設計系',
  className: row.class_name ?? '',
  year: row.grade ?? '',
  role: row.role,
  accountLevel: row.account_level,
  passwordHash: '',
  isFirstLogin: false,
  emailVerified: true,
  createdAt: row.created_at?.slice(0, 10) ?? '',
  lastLogin: null
})

export async function supabaseLogin(studentId: string, password: string): Promise<LoginResult> {
  // 1. 學號 → email
  const { data: email, error: lookupError } = await supabase.rpc('email_for_student', { sid: studentId })
  if (lookupError || !email) {
    return { success: false, error: 'user_not_found', message: '查無此學號' }
  }

  // 2. 密碼驗證（Supabase 內建 bcrypt 與 rate limiting）
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session || !data.user) {
    return { success: false, error: 'invalid_password', message: '密碼錯誤' }
  }

  // 3. 撈 profile（RLS：本人可讀自己）
  const { data: profile, error: profileError } = await supabase
    .from('students')
    .select('*')
    .eq('id', data.user.id)
    .single()

  if (profileError || !profile) {
    return { success: false, message: '讀取學生資料失敗，請聯繫系學會' }
  }

  return {
    success: true,
    student: toStudent(profile as StudentRow),
    token: data.session.access_token,
    expiresIn: EXPIRES_IN
  }
}

export async function supabaseLogout(): Promise<void> {
  await supabase.auth.signOut()
}

// 即時查自己的 account_level（停權即時反映，不依賴登入時的快照）
// ponytail: 60 秒模組層快取，多個元件同掛載不重複打；未登入或失敗回 null 由呼叫端退回快照
let levelCache: { value: number; at: number } | null = null
export async function fetchMyAccountLevel(): Promise<number | null> {
  if (levelCache && Date.now() - levelCache.at < 60_000) return levelCache.value
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('students')
    .select('account_level')
    .eq('id', auth.user.id)
    .single()
  if (error || !data) return null
  levelCache = { value: data.account_level, at: Date.now() }
  return data.account_level
}

/** 忘記密碼：以學號寄送重設信，回傳遮罩後的 email 供 UI 顯示 */
export async function requestPasswordReset(
  studentId: string
): Promise<{ ok: boolean; maskedEmail?: string; message?: string }> {
  const { data: email } = await supabase.rpc('email_for_student', { sid: studentId })
  if (!email) return { ok: false, message: '查無此學號' }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  if (error) return { ok: false, message: '寄送失敗，請稍後再試' }

  const [local, domain] = String(email).split('@')
  return { ok: true, maskedEmail: `${local.slice(0, 3)}***@${domain}` }
}

/** 重設密碼頁：使用者點信中連結進來後，設定新密碼 */
export async function updatePassword(newPassword: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 修改密碼（Profile 頁）：先以目前密碼重新驗證，再更新 */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; wrongCurrent?: boolean; message?: string }> {
  const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
  if (reauthError) return { ok: false, wrongCurrent: true }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, message: error.message }
  return { ok: true }
}

/** 更新自己的手機號碼（RPC：security definer，只能改本人的 phone 欄位） */
export async function updateMyPhone(phone: string): Promise<{ ok: boolean }> {
  const { error } = await supabase.rpc('update_my_phone', { p_phone: phone })
  if (error) console.error('更新手機號碼失敗:', error)
  return { ok: !error }
}
