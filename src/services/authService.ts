/**
 * Supabase 認證服務
 * 登入流程：學生＝學校 Google 帳號（renderGoogleButton 拿 ID token → signInWithGoogle）；
 * 密碼帳號（admin sccdsa，以及 Google 設定完成前仍開放的有密碼學生帳號）＝學號 → email（RPC email_for_student）→ Supabase Auth 驗證。兩者最後都撈 students profile。
 * 取代已移除的 mock 登入（原 utils/testAuthData）。
 */

import { supabase } from './supabase'
import type { Student, LoginResult } from '../utils/authTypes'
import { tr } from '../stores/langStore'

// app 登入資料的閒置效期：30 天沒開 app 才過期（AuthContext 每次開啟把 loginTime 續成現在）；
// Supabase 憑證由 refresh token 自動續期，過期時兩者一起登出。admin 另有固定期限，見 authStorage.isLoginExpired
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

// Google Identity Services（accounts.google.com/gsi/client）用到的部分
interface Gis {
  initialize: (o: { client_id: string; nonce: string; callback: (r: { credential: string }) => void }) => void
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
}
let gis: Promise<Gis> | null = null
const loadGis = () => gis ??= new Promise<Gis>((resolve, reject) => {
  const s = document.createElement('script')
  s.src = 'https://accounts.google.com/gsi/client'
  s.onload = () => resolve((window as unknown as { google: { accounts: { id: Gis } } }).google.accounts.id)
  s.onerror = () => { gis = null; reject(new Error('Google 登入元件載入失敗')) }
  document.head.appendChild(s)
})

/**
 * 學校 Google 帳號登入（2026-11-10 改 Google 自己的按鈕＋ID token）：按鈕由 Google 畫在 el 裡，選完帳號在本頁拿到 ID token，
 * 不再整頁導去 supabase.co——Google 畫面顯示的是本站網域，不用買 Supabase 自訂網域。拿到後交給 signInWithGoogle。
 * 樣式只能用 Google 給的選項（品牌規範，文字也是 Google 的）。
 */
export async function renderGoogleButton(el: HTMLElement, locale: 'zh-TW' | 'en', onCredential: (token: string, nonce: string) => void) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('缺少環境變數 VITE_GOOGLE_CLIENT_ID（見 .env.example）')
  const id = await loadGis()
  // nonce：Google 收雜湊、Supabase 收原值比對，ID token 被攔下也不能拿去別處重放
  const nonce = crypto.randomUUID()
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce)))
  id.initialize({
    client_id: clientId,
    nonce: Array.from(hash, b => b.toString(16).padStart(2, '0')).join(''),
    callback: ({ credential }) => onCredential(credential, nonce)
  })
  id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale, width: el.offsetWidth })
}

/** Google 給的 ID token 換 Supabase 登入，再撈 profile（同密碼登入的 3、4 步）。本系規則（網域、封閉名單）在 DB trigger 把關，不符的帳號建不起來 */
export async function signInWithGoogle(token: string, nonce: string): Promise<LoginResult> {
  const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })
  if (error || !data.session || !data.user) return { success: false, message: googleRejectMessage() }
  return loadProfile(data.user.id, data.session.access_token, 'google')
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
  // local＝只登出這台，不動其他裝置的憑證（預設是 global）
  await supabase.auth.signOut({ scope: 'local' })
}

/** 後台權限（operator-access.sql）：admin＝最高權限、operator＝學會成員、expired＝學會成員但這次登入滿 12 小時、none＝沒有 */
export type BackendAccess = 'admin' | 'operator' | 'expired' | 'none'

/** 離線查不到回 null */
export async function fetchBackendAccess(): Promise<BackendAccess | null> {
  const { data } = await supabase.rpc('backend_access')
  return data
}

/** 後台 2FA 的下一步：已通過／輸入驗證碼／第一次綁定（QR） */
export type MfaStep =
  | { kind: 'passed' }
  | { kind: 'verify'; factorId: string }
  | { kind: 'enroll'; factorId: string; qrCode: string; secret: string }

export async function getMfaStep(): Promise<MfaStep> {
  const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw error
  if (aal.currentLevel === 'aal2') return { kind: 'passed' }

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) throw listError
  if (factors.totp[0]) return { kind: 'verify', factorId: factors.totp[0].id }

  // 上次綁到一半留下的未驗證 factor 先清掉，再綁才不會撞名。已綁定後 server 不讓只過帳密的 session 新增，別人無法改綁
  for (const f of factors.all.filter(f => f.status === 'unverified')) {
    await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
  if (enrollError) throw enrollError
  return { kind: 'enroll', factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/** 驗證 6 位數碼（綁定與登入同一步） */
export async function verifyMfa(factorId: string, code: string): Promise<boolean> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  return !error
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
