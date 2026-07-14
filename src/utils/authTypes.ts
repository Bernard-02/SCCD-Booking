/**
 * 認證相關型別（登入資料以 Supabase 為準）。
 * 註：原 testAuthData.ts 的 mock 帳號與 mockApiLogin 已於接線 Supabase 後移除，
 * 此檔僅保留跨模組共用的型別；實際登入走 services/authService.ts。
 */

// 學生資料介面
export interface Student {
  studentId: string
  name: string
  email: string
  phone: string | null
  department: string
  className: string
  year: string
  role?: 'student' | 'admin' | 'staff' // Supabase students.role；未帶視為 student
  accountLevel?: number // 帳號狀態 0-5（依累計逾期天數）
  passwordHash: string
  isFirstLogin: boolean
  emailVerified: boolean
  createdAt: string
  lastLogin: string | null
}

// 登入結果介面
export interface LoginResult {
  success: boolean
  student?: Student
  token?: string
  expiresIn?: number
  message?: string
  error?: 'user_not_found' | 'invalid_password' | 'account_locked'
  errorCode?: string
  remainingTime?: number
}
