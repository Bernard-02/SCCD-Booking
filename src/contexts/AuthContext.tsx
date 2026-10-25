/**
 * 認證 Context
 * 提供全局認證狀態管理，並預留 Firebase 整合接口
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Student, LoginResult } from '../utils/authTypes'
import { tr } from '../stores/langStore'
import { supabaseLogin, supabaseLogout, signInWithGoogle, finishGoogleLogin as finishGoogle } from '../services/authService'
import { supabase, persistAuth } from '../services/supabase'
import { readLoginData } from '../utils/authStorage'
import type { LoginData } from '../utils/authStorage'

interface AuthContextType {
  currentUser: Student | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (studentId: string, password: string, rememberMe?: boolean) => Promise<LoginResult>
  loginWithGoogle: (rememberMe: boolean) => Promise<boolean>
  finishGoogleLogin: () => Promise<LoginResult | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// localStorage key
const STORAGE_KEY = 'sccd_login_data'
// Google 登入進行中（sessionStorage，值＝記住我 '1'／'0'）：導去 Google 再跳回來，靠它記住勾選並辨認「剛從 Google 回來」
// （重設密碼信點進來也是「有憑證、沒 app 資料」，不能只看 session）
const GOOGLE_PENDING_KEY = 'sccd_google_pending'

// Props for AuthProvider
interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Student | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 從 storage 載入用戶數據
  const loadUserFromStorage = useCallback((): Student | null => {
    const data = readLoginData()
    if (!data) return null

    // 檢查是否過期（閒置效期：loginTime＝最後一次開啟 app）；過期連 Supabase 憑證一起登出
    const now = Date.now()
    const expiryTime = data.loginTime + data.expiresIn

    if (now > expiryTime) {
      clearStorage()
      supabaseLogout().catch(() => {})
      return null
    }

    // 續期：寫回原本所在的 storage（記住我＝local，否則 session）
    const storage = data.rememberMe ? localStorage : sessionStorage
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...data, loginTime: now }))

    return data.student
  }, [])

  // 清除 storage
  const clearStorage = () => {
    localStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(STORAGE_KEY)
  }

  // 保存用戶數據到 storage
  const saveUserToStorage = (student: Student, token: string, expiresIn: number, rememberMe: boolean) => {
    const loginData: LoginData = {
      student,
      token,
      loginTime: Date.now(),
      expiresIn,
      rememberMe
    }

    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem(STORAGE_KEY, JSON.stringify(loginData))
  }

  // 登入
  const login = useCallback(async (studentId: string, password: string, rememberMe: boolean = false): Promise<LoginResult> => {
    try {
      const result = await supabaseLogin(studentId, password)

      if (result.success && result.student && result.token && result.expiresIn) {
        saveUserToStorage(result.student, result.token, result.expiresIn, rememberMe)
        persistAuth(rememberMe) // Supabase 憑證跟著記住我放 local／session
        setCurrentUser(result.student)
      }

      return result
    } catch (error) {
      console.error('[AuthContext] 登入錯誤:', error)
      return {
        success: false,
        message: tr('Something went wrong while logging in.', '登入過程發生錯誤')
      }
    }
  }, [])

  // Google 登入：先記下記住我，再整頁導去 Google（成功時不會回到這裡）
  const loginWithGoogle = useCallback(async (rememberMe: boolean) => {
    sessionStorage.setItem(GOOGLE_PENDING_KEY, rememberMe ? '1' : '0')
    const ok = await signInWithGoogle()
    if (!ok) sessionStorage.removeItem(GOOGLE_PENDING_KEY)
    return ok
  }, [])

  // Google 跳回首頁後由 HomePage 呼叫；不是剛從 Google 回來回傳 null
  const finishGoogleLogin = useCallback(async (): Promise<LoginResult | null> => {
    const pending = sessionStorage.getItem(GOOGLE_PENDING_KEY)
    if (pending === null) return null
    sessionStorage.removeItem(GOOGLE_PENDING_KEY)
    // 在 Google 按取消：不算錯誤，不顯示訊息
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
    if (params.get('error') === 'access_denied') return { success: false }
    const result = await finishGoogle()
    if (result.success && result.student && result.token && result.expiresIn) {
      const remember = pending === '1'
      saveUserToStorage(result.student, result.token, result.expiresIn, remember)
      persistAuth(remember)
      setCurrentUser(result.student)
    } else {
      await supabaseLogout().catch(() => {})
    }
    return result
  }, [])

  // 登出（同時結束 Supabase session）
  const logout = useCallback(async () => {
    try {
      await supabaseLogout()
      clearStorage()
      setCurrentUser(null)
    } catch (error) {
      console.error('登出錯誤:', error)
    }
  }, [])

  // 初始化：載入用戶數據
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true)

      let user = loadUserFromStorage()
      // app 登入資料還在、但 Supabase 憑證已沒了（被撤銷、手動清除…）→ 視為登出，免得畫面顯示已登入、RPC 卻全回「未登入」。
      // 反過來（只有憑證、沒有 app 資料）不登出：重設密碼信點進來就是這狀態
      if (user) {
        // 有 error（例：離線續期失敗）先不登出，下次開啟再判。
        // 閒置回來 token 已過期時 getSession 會先續期，supabase-js 的 navigator.locks／網路請求在分頁被暫停過後可能卡住不回：
        // 等最多 4 秒，逾時就先用 storage 的登入資料放行（權限防線在 RLS，憑證真的沒了之後的 API 會自己回未登入）
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 4000))
        ])
        if (result === null) console.warn('[auth] getSession 逾時，先沿用本機登入資料')
        else if (!result.data.session && !result.error) {
          clearStorage()
          user = null
        }
      }
      setCurrentUser(user)
      setIsLoading(false)
    }

    initAuth()
  }, [loadUserFromStorage])

  // 監聽 storage 變化（跨標籤頁同步）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        if (e.newValue) {
          try {
            const data: LoginData = JSON.parse(e.newValue)
            setCurrentUser(data.student)
          } catch (error) {
            console.error('解析登入數據錯誤:', error)
            setCurrentUser(null)
          }
        } else {
          setCurrentUser(null)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const value: AuthContextType = {
    currentUser,
    isLoading,
    isAuthenticated: currentUser !== null,
    login,
    loginWithGoogle,
    finishGoogleLogin,
    logout
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// 自定義 Hook 來使用 AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// 導出類型供其他組件使用
export type { AuthContextType }
