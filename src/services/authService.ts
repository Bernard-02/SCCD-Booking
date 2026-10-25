/**
 * Supabase 認證服務
 * 登入流程：學生＝學校 Google 帳號（signInWithGoogle → 跳回 → finishGoogleLogin）；
 * 密碼帳號（admin sccdsa，以及 Google 設定完成前仍開放的有密碼學生帳號）＝學號 → email（RPC email_for_student）→ Supabase Auth 驗證。兩者最後都撈 students profile。
 * 取代已移除的 mock 登入（原 utils/testAuthData）。
 */

import { supabase } from './supabase'
import type { Student, LoginResult } from '../utils/authTypes'
import { tr } from '../stores/langStore'

// app 登入資料的閒置效期：30 天沒開 app 才過期（AuthContext 每次開啟把 loginTime 續成現在）；
// Supabase 憑證由 refresh token 自動續期，過期時兩者一起登出
const EXPIRES_IN = 30 * 24 * 60 * 60 * 1000

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
  graduated?: boolean // members.sql；SQL 執行前不存在
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
    return { success: false, error: 'user_not_found', message: tr('Student ID not found', '查無此學號') }
  }

  // 2. 密碼驗證（Supabase 內建 bcrypt 與 rate limiting）
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session || !data.user) {
    return { success: false, error: 'invalid_password', message: tr('Incorrect password', '密碼錯誤') }
  }
  return loadProfile(data.user.id, data.session.access_token, 'email')
}

/**
 * 學校 Google 帳號登入（google-login.sql）：導去 Google，選完帳號跳回首頁，再由 finishGoogleLogin 接手。
 * 本系規則（網域、學號班級代碼、例外名單）在 DB trigger 把關，不符的帳號根本建不起來。
 */
export async function signInWithGoogle(): Promise<boolean> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/`, queryParams: { prompt: 'select_account' } }
  })
  return !error
}

/** Google 跳回來後：supabase-js 已從網址取出 session，這裡撈 profile（同密碼登入的 3、4 步） */
export async function finishGoogleLogin(): Promise<LoginResult> {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return { success: false, message: googleRejectMessage() }
  return loadProfile(data.session.user.id, data.session.access_token, 'google')
}

/** trigger 擋下時 Supabase 只回「Database error saving new user」，原因統一這樣講 */
export const googleRejectMessage = () =>
  tr(
    'Please sign in with your school Google account (@gm, gm1 or gm2.usc.edu.tw). Only accounts registered by the SA can sign in — contact the SA if you are not registered yet.',
    '請使用學校 Google 帳號（@gm／gm1／gm2.usc.edu.tw）登入；只有系學會登記過的帳號能登入，尚未登記請聯繫系學會'
  )

async function loadProfile(userId: string, token: string, provider: 'email' | 'google'): Promise<LoginResult> {
  // 3. 撈 profile（RLS：本人可讀自己）
  const { data: profile, error: profileError } = await supabase
    .from('students')
    .select('*')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    return { success: false, message: tr('Couldn’t load your student profile. Please contact the SA.', '讀取學生資料失敗，請聯繫系學會') }
  }

  // 4. 畢業生停用（2026-10-04 Bernard 定；後台會員管理手動標記，不依年級自動判定）：
  //    不能登入——除非還有東西沒歸還（待繳押金／租借中／逾期），歸還結案後就登不進來。
  //    ponytail: App 層擋（Auth 帳號仍在）；RLS 只給讀自己的資料、新單由 submit_orders 擋，夠用
  if ((profile as StudentRow).graduated) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', userId)
      .in('status', ['pending', 'in-progress', 'overdue'])
    if (!count) {
      await supabase.auth.signOut()
      return { success: false, error: 'account_locked', message: tr('This account has been deactivated (graduated). Please contact the SA if you have questions.', '帳號已停用（已畢業），如有疑問請聯繫系學會') }
    }
  }

  return {
    success: true,
    student: { ...toStudent(profile as StudentRow), provider },
    token,
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
  if (!email) return { ok: false, message: tr('Student ID not found', '查無此學號') }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  if (error) return { ok: false, message: tr('Failed to send. Please try again later.', '寄送失敗，請稍後再試') }

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
